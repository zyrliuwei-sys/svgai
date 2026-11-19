import { Resvg } from '@cf-wasm/resvg';
import { convertIndexedToRgb, decode } from 'fast-png';
import { Unzlib } from 'fflate';

import { traceRaster } from '@/lib/svg-trace-options';
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
function normalizedPng(bytes: Uint8Array, edge = 512) {
  const info = inspectRaster(bytes, 'image/png');
  if (
    info.width > edge ||
    info.height > edge ||
    info.width * info.height > 2_500_000 ||
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

function readPixels(bytes: Uint8Array) {
  const decoded = decode(bytes, { checkCrc: true });
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
  return { data, width: png.width, height: png.height };
}

async function renderTrace(
  pixels: ReturnType<typeof readPixels>,
  colors: number,
  removeBackground: boolean
) {
  if (removeBackground) removeEdgeBackground(pixels);
  const raw = await traceRaster(pixels, colors);
  const svg = sanitizeSvg(raw).replace(
    /<path\b(?=[^>]*\bopacity="0(?:\.0+)?")[^>]*\/>/g,
    ''
  );
  const stats = getSvgStats(svg);
  if (!stats.paths || stats.bytes > 250_000) throw new Error('invalid_image');
  return svg;
}

export function traceImage(input: SvgImageInput) {
  return renderTrace(
    readPixels(Buffer.from(input.image, 'base64')),
    input.colors,
    input.removeBackground
  );
}

/** Reduce the provider's bounded 1K bitmap to our tracing canvas. Average
 * premultiplied colors so transparent pixels do not leave dark outlines. */
export function traceEditedImage(
  bytes: Uint8Array,
  colors: number,
  removeBackground: boolean
) {
  const source = readPixels(normalizedPng(bytes, 2048));
  const scale = Math.min(1, 512 / Math.max(source.width, source.height));
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));
  const pixels = {
    width,
    height,
    data: new Uint8ClampedArray(width * height * 4),
  };
  for (let y = 0; y < height; y++) {
    const top = Math.floor((y * source.height) / height);
    const bottom = Math.floor(((y + 1) * source.height) / height);
    for (let x = 0; x < width; x++) {
      const left = Math.floor((x * source.width) / width);
      const right = Math.floor(((x + 1) * source.width) / width);
      let r = 0,
        g = 0,
        b = 0,
        alpha = 0;
      for (let sy = top; sy < bottom; sy++) {
        for (let sx = left; sx < right; sx++) {
          const offset = (sy * source.width + sx) * 4;
          const a = source.data[offset + 3];
          r += source.data[offset] * a;
          g += source.data[offset + 1] * a;
          b += source.data[offset + 2] * a;
          alpha += a;
        }
      }
      if (alpha)
        pixels.data.set(
          [
            r / alpha,
            g / alpha,
            b / alpha,
            alpha / ((bottom - top) * (right - left)),
          ],
          (y * width + x) * 4
        );
    }
  }
  return renderTrace(pixels, colors, removeBackground);
}
