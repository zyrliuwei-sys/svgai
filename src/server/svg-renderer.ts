import { Resvg } from '@cf-wasm/resvg';
import { convertIndexedToRgb, decode } from 'fast-png';
import { Unzlib } from 'fflate';

import {
  getSvgStats,
  inspectRaster,
  removeEdgeBackground,
  sanitizeSvg,
} from '@/lib/svg-vectorizer';

export async function rasterizeSvg(svg: string): Promise<string> {
  const safe = sanitizeSvg(svg);
  const stats = getSvgStats(safe);
  if (
    !stats.width ||
    !stats.height ||
    stats.width / stats.height > 10 ||
    stats.height / stats.width > 10
  )
    throw new Error('Unsupported artwork dimensions');
  const renderer = await Resvg.async(safe, {
    fitTo: { mode: 'zoom', value: 512 / Math.max(stats.width, stats.height) },
    font: { loadSystemFonts: false },
  });
  try {
    const image = renderer.render();
    try {
      const bytes = image.asPng();
      if (bytes.length > 800_000) throw new Error('Preview is too large');
      return Buffer.from(bytes).toString('base64');
    } finally {
      image.free();
    }
  } finally {
    renderer.free();
  }
}

export interface SvgImageInput {
  image: string;
  colors: number;
  removeBackground: boolean;
}

/** Accept the bounded non-interlaced RGB(A) PNG emitted by our browser canvas.
 * Strip metadata, and bound inflation before the image decoder allocates pixels. */
function normalizedPng(bytes: Uint8Array) {
  const info = inspectRaster(bytes, 'image/png');
  if (
    info.width > 512 ||
    info.height > 512 ||
    bytes[24] !== 8 ||
    ![2, 6].includes(bytes[25]!) ||
    bytes[26] !== 0 ||
    bytes[27] !== 0 ||
    bytes[28] !== 0
  )
    throw new Error('invalid_input');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const parts: Uint8Array[] = [bytes.subarray(0, 8)];
  const compressed: Uint8Array[] = [];
  let offset = 8,
    ended = false,
    header = false,
    chunks = 0;
  while (offset < bytes.length) {
    if (offset + 12 > bytes.length || ++chunks > 1024)
      throw new Error('invalid_input');
    const length = view.getUint32(offset);
    const end = offset + 12 + length;
    if (end > bytes.length) throw new Error('invalid_input');
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    if (type === 'IHDR') {
      if (header || offset !== 8 || length !== 13)
        throw new Error('invalid_input');
      header = true;
    }
    if (type === 'IDAT') compressed.push(bytes.subarray(offset + 8, end - 4));
    if (['IHDR', 'IDAT', 'IEND'].includes(type))
      parts.push(bytes.subarray(offset, end));
    else if (type[0] === type[0]?.toUpperCase())
      throw new Error('invalid_input');
    offset = end;
    if (type === 'IEND') {
      ended = true;
      break;
    }
  }
  if (!header || !ended || offset !== bytes.length || !compressed.length)
    throw new Error('invalid_input');
  const expected = (info.width * (bytes[25] === 6 ? 4 : 3) + 1) * info.height;
  let inflated = 0;
  const inflater = new Unzlib((chunk) => {
    inflated += chunk.length;
    if (inflated > expected)
      throw new Error('PNG decompressed data exceeds its dimensions');
  });
  for (const chunk of compressed)
    for (let start = 0; start < chunk.length; start += 256)
      inflater.push(chunk.subarray(start, start + 256), false);
  inflater.push(new Uint8Array(), true);
  if (inflated !== expected) throw new Error('invalid_input');
  const output = new Uint8Array(
    parts.reduce((total, p) => total + p.length, 0)
  );
  let position = 0;
  for (const part of parts) {
    output.set(part, position);
    position += part.length;
  }
  return output;
}
export function parseImageInput(raw: unknown): SvgImageInput {
  if (!raw || typeof raw !== 'object') throw new Error('invalid_input');
  const input = raw as Record<string, unknown>;
  if (
    typeof input.image !== 'string' ||
    input.image.length > 1_500_000 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(input.image) ||
    ![4, 8, 16].includes(Number(input.colors)) ||
    typeof input.removeBackground !== 'boolean'
  )
    throw new Error('invalid_input');
  const bytes = Buffer.from(input.image, 'base64');
  const info = inspectRaster(bytes, 'image/png');
  if (info.width > 512 || info.height > 512 || info.type !== 'image/png')
    throw new Error('invalid_input');
  return {
    image: Buffer.from(normalizedPng(bytes)).toString('base64'),
    colors: Number(input.colors),
    removeBackground: input.removeBackground,
  };
}

export async function traceImage(input: SvgImageInput): Promise<string> {
  const decoded = decode(Buffer.from(input.image, 'base64'), {
    checkCrc: true,
  });
  const png = decoded.palette
    ? {
        ...decoded,
        data: convertIndexedToRgb(decoded),
        channels: decoded.palette[0]!.length,
        depth: 8,
      }
    : decoded;
  const data = new Uint8ClampedArray(png.width * png.height * 4);
  const max = png.depth === 16 ? 65535 : 255;
  for (let pixel = 0; pixel < png.width * png.height; pixel++) {
    const source = pixel * png.channels;
    for (let channel = 0; channel < 3; channel++) {
      const index = png.channels <= 2 ? source : source + channel;
      data[pixel * 4 + channel] = Math.round((png.data[index]! * 255) / max);
    }
    data[pixel * 4 + 3] =
      png.channels === 2 || png.channels === 4
        ? Math.round((png.data[source + png.channels - 1]! * 255) / max)
        : 255;
  }
  const pixels = { data, width: png.width, height: png.height };
  if (input.removeBackground) removeEdgeBackground(pixels);
  // @ts-expect-error ImageTracerJS has no type declarations.
  const imported = await import('imagetracerjs');
  const tracer = imported.default ?? imported;
  const raw = tracer.imagedataToSVG(pixels, {
    ltres: 1,
    qtres: 1,
    pathomit: 10,
    colorsampling: 2,
    numberofcolors: input.colors,
    colorquantcycles: 3,
    layering: 0,
    strokewidth: 0,
    linefilter: true,
    roundcoords: 2,
    viewbox: true,
    desc: false,
  });
  const svg = sanitizeSvg(raw).replace(
    /<path\b(?=[^>]*\bopacity="0(?:\.0+)?")[^>]*\/>/g,
    ''
  );
  const stats = getSvgStats(svg);
  if (!stats.paths || stats.bytes > 250_000) throw new Error('invalid_image');
  return svg;
}
