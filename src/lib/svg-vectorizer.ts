import { traceRaster } from '@/lib/svg-trace-options';

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 20_000_000;
const MAX_IMAGE_EDGE = 12_000;
const TRACE_EDGE = 768;
const MAX_SVG_BYTES = 1_500_000;
const VECTOR_TAGS = new Set([
  'svg',
  'g',
  'path',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polygon',
  'polyline',
]);
const SHAPE_TAGS = new Set([
  'path',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polygon',
  'polyline',
]);
const NUMBER = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?$/;
const NUMBER_LIST = /^[\s,\d.eE+\-]+$/;
const NUMERIC_ATTRIBUTES = new Set([
  'x',
  'y',
  'x1',
  'y1',
  'x2',
  'y2',
  'cx',
  'cy',
  'r',
  'rx',
  'ry',
  'stroke-width',
  'stroke-miterlimit',
  'opacity',
  'fill-opacity',
  'stroke-opacity',
]);

function invalidSvg(): never {
  throw new Error('The SVG contains unsupported or unsafe content.');
}

function boundedNumbers(value: string): boolean {
  const numbers = value.match(/[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g);
  return (
    !!numbers?.length &&
    numbers.every((n) => Number.isFinite(+n) && Math.abs(+n) <= 10_000_000)
  );
}

function normalizePaint(value: string): string | null {
  const paint = value.trim().toLowerCase();
  if (paint === 'none' || paint === 'transparent' || paint === 'currentcolor')
    return paint;
  if (/^#[0-9a-f]{3,4}$/.test(paint)) {
    return '#' + [...paint.slice(1)].map((c) => c + c).join('');
  }
  if (/^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/.test(paint)) return paint;
  if (/^rgba?\([\d\s.,%/]+\)$/.test(paint) && boundedNumbers(paint)) {
    const channels = paint
      .slice(paint.indexOf('(') + 1, -1)
      .trim()
      .split(/[\s,/]+/);
    if (channels.length !== 3 && channels.length !== 4) return null;
    const values = channels
      .slice(0, 3)
      .map((channel) =>
        channel.endsWith('%')
          ? Number(channel.slice(0, -1)) * 2.55
          : Number(channel)
      );
    if (
      values.some(
        (value) => !Number.isFinite(value) || value < 0 || value > 255
      )
    )
      return null;
    const hex = values
      .map((value) => Math.round(value).toString(16).padStart(2, '0'))
      .join('');
    if (channels.length === 3) return '#' + hex;
    const rawAlpha = channels[3];
    const alpha = rawAlpha.endsWith('%')
      ? Number(rawAlpha.slice(0, -1)) / 100
      : Number(rawAlpha);
    if (!Number.isFinite(alpha) || alpha < 0 || alpha > 1) return null;
    return (
      '#' +
      hex +
      (alpha < 1
        ? Math.round(alpha * 255)
            .toString(16)
            .padStart(2, '0')
        : '')
    );
  }
  const named: Record<string, string> = {
    black: '#000000',
    white: '#ffffff',
    red: '#ff0000',
    blue: '#0000ff',
    green: '#008000',
    yellow: '#ffff00',
    orange: '#ffa500',
    gray: '#808080',
    grey: '#808080',
    purple: '#800080',
    pink: '#ffc0cb',
    brown: '#a52a2a',
    navy: '#000080',
    teal: '#008080',
    coral: '#ff7f50',
    ivory: '#fffff0',
  };
  return named[paint] ?? null;
}

function sanitizeAttribute(name: string, value: string): string | null {
  if (/[<&>"'`]/.test(value)) invalidSvg();
  if (name === 'xmlns') {
    if (value !== 'http://www.w3.org/2000/svg') invalidSvg();
    return value;
  }
  if (name === 'version')
    return value === '1.1' || value === '1.0' ? value : null;
  if (name === 'fill' || name === 'stroke') return normalizePaint(value);
  if (name === 'viewBox') {
    const values = value.trim().split(/[\s,]+/);
    if (
      values.length !== 4 ||
      values.some((v) => !NUMBER.test(v)) ||
      !boundedNumbers(value) ||
      +values[2] <= 0 ||
      +values[3] <= 0
    )
      invalidSvg();
    return values.join(' ');
  }
  if (name === 'width' || name === 'height') {
    const number = value.replace(/px$/, '');
    if (!NUMBER.test(number) || !boundedNumbers(number) || +number <= 0)
      invalidSvg();
    return number;
  }
  if (NUMERIC_ATTRIBUTES.has(name)) {
    if (!NUMBER.test(value) || !boundedNumbers(value)) invalidSvg();
    return value;
  }
  if (name === 'd') {
    if (
      !/^[\s,\d.eE+\-aAcChHlLmMqQsStTvVzZ]*$/.test(value) ||
      !boundedNumbers(value)
    )
      invalidSvg();
    return value;
  }
  if (name === 'points') {
    if (!NUMBER_LIST.test(value) || !boundedNumbers(value)) invalidSvg();
    return value;
  }
  if (name === 'transform') {
    const remainder = value.replace(
      /(?:matrix|translate|scale|rotate|skewX|skewY)\s*\([\s,\d.eE+\-]+\)/g,
      ''
    );
    if (remainder.trim() || !boundedNumbers(value)) invalidSvg();
    return value;
  }
  const enumValues: Record<string, string[]> = {
    'fill-rule': ['nonzero', 'evenodd'],
    'clip-rule': ['nonzero', 'evenodd'],
    'stroke-linecap': ['butt', 'round', 'square'],
    'stroke-linejoin': ['miter', 'round', 'bevel'],
    'vector-effect': ['non-scaling-stroke', 'none'],
    preserveAspectRatio: [
      'none',
      'xMidYMid meet',
      'xMidYMid slice',
      'xMinYMin meet',
      'xMaxYMax meet',
    ],
  };
  if (enumValues[name]) return enumValues[name].includes(value) ? value : null;
  // Unknown attributes are removed, including events, CSS, references and links.
  return null;
}

/** A deliberately small static-SVG dialect, shared by browser and SSR helpers.
 * Rejects entities, executable/foreign elements and malformed nesting; strips
 * unsupported attributes. The result contains only local vector geometry.
 */
export function sanitizeSVG(input: string): string {
  if (
    typeof input !== 'string' ||
    new TextEncoder().encode(input).length > MAX_SVG_BYTES
  )
    invalidSvg();
  const source = input
    .trim()
    .replace(/^<\?xml[^?]*\?>\s*/i, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    // Providers may serialize formatting whitespace as XML character references.
    // Decode only XML whitespace; every other entity still fails closed below.
    .replace(/&#(?:0*(?:9|10|13)|x0*[9ad]);/gi, ' ');
  if (/<!|<\?|&/.test(source)) invalidSvg();
  if (typeof DOMParser !== 'undefined') {
    const document = new DOMParser().parseFromString(source, 'image/svg+xml');
    if (
      document.querySelector('parsererror') ||
      document.documentElement.localName !== 'svg'
    )
      invalidSvg();
  }
  const stack: string[] = [];
  let result = '';
  let offset = 0;
  let elements = 0;
  let roots = 0;
  const tokens = source.matchAll(/<[^>]*>/g);
  for (const match of tokens) {
    if (source.slice(offset, match.index).trim()) invalidSvg();
    offset = match.index! + match[0].length;
    const token = match[0];
    const close = token.match(/^<\/([A-Za-z][A-Za-z0-9]*)\s*>$/);
    if (close) {
      if (stack.pop() !== close[1]) invalidSvg();
      result += `</${close[1]}>`;
      continue;
    }
    const open = token.match(/^<([A-Za-z][A-Za-z0-9]*)([\s\S]*?)(\/?)>$/);
    if (!open || !VECTOR_TAGS.has(open[1]) || ++elements > 16_000) invalidSvg();
    const [, tag, attributeSource, selfClosing] = open;
    if (!stack.length) {
      if (tag !== 'svg' || ++roots !== 1) invalidSvg();
    } else if (tag === 'svg') invalidSvg();
    const attrs: string[] = [];
    const seen = new Set<string>();
    let attrOffset = 0;
    for (const attribute of attributeSource.matchAll(
      /([A-Za-z_:][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g
    )) {
      if (attributeSource.slice(attrOffset, attribute.index).trim())
        invalidSvg();
      attrOffset = attribute.index! + attribute[0].length;
      const name = attribute[1];
      if (seen.has(name)) invalidSvg();
      seen.add(name);
      const value = sanitizeAttribute(name, attribute[2] ?? attribute[3]);
      if (value !== null) attrs.push(`${name}="${value}"`);
    }
    if (attributeSource.slice(attrOffset).trim()) invalidSvg();
    if (tag === 'svg' && !seen.has('xmlns'))
      attrs.unshift('xmlns="http://www.w3.org/2000/svg"');
    result += `<${tag}${attrs.length ? ' ' + attrs.join(' ') : ''}${selfClosing ? '/>' : '>'}`;
    if (!selfClosing) stack.push(tag);
  }
  if (source.slice(offset).trim() || stack.length || roots !== 1 || !elements)
    invalidSvg();
  return result;
}

export const sanitizeSvg = sanitizeSVG;

export function getSvgStats(input: string): {
  paths: number;
  colors: string[];
  bytes: number;
  width: number;
  height: number;
} {
  const svg = sanitizeSVG(input);
  const root = svg.match(/^<svg\b[^>]*>/)?.[0] ?? '';
  const viewBox = root
    .match(/\bviewBox="([^"]+)"/)?.[1]
    .split(/[\s,]+/)
    .map(Number);
  const dimension = (key: string) =>
    Number(root.match(new RegExp(`\\b${key}="([^"]+)"`))?.[1] ?? 512);
  const colors = [
    ...new Set(
      [...svg.matchAll(/\b(?:fill|stroke)="([^"]+)"/g)]
        .map((m) => m[1])
        .filter(
          (color) => !['none', 'transparent', 'currentcolor'].includes(color)
        )
    ),
  ];
  return {
    paths: [...svg.matchAll(/<path\b/g)].length,
    colors,
    bytes: new TextEncoder().encode(svg).length,
    width: viewBox?.[2] ?? dimension('width'),
    height: viewBox?.[3] ?? dimension('height'),
  };
}

export function recolorSvg(input: string, from: string, to: string): string {
  const source = normalizePaint(from);
  const target = normalizePaint(to);
  if (
    !source ||
    !target ||
    ['none', 'transparent', 'currentcolor'].includes(target)
  )
    invalidSvg();
  return sanitizeSVG(input).replace(
    /\b(fill|stroke)="([^"]+)"/g,
    (match, attribute: string, value: string) =>
      value === source ? `${attribute}="${target}"` : match
  );
}

export function outlineSvg(input: string): string {
  return sanitizeSVG(input).replace(
    /<([a-z]+)\b([^>]*?)(\/?)>/g,
    (match, tag: string, attributes: string, closing: string) => {
      if (!SHAPE_TAGS.has(tag)) return match;
      const clean = attributes.replace(
        /\s(?:fill|stroke|stroke-width|stroke-linejoin|vector-effect)="[^"]*"/g,
        ''
      );
      return `<${tag}${clean} fill="none" stroke="#3155b5" stroke-width="1.5" stroke-linejoin="round" vector-effect="non-scaling-stroke"${closing}>`;
    }
  );
}

export function svgToDataUrl(input: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sanitizeSVG(input))}`;
}

export interface RasterInfo {
  type: 'image/png' | 'image/jpeg' | 'image/webp';
  width: number;
  height: number;
}

/** Read dimensions before decoding so huge compressed images are rejected early. */
export function inspectRaster(bytes: Uint8Array, claimedMime = ''): RasterInfo {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let info: RasterInfo | undefined;
  if (
    bytes.length >= 24 &&
    bytes[0] === 137 &&
    String.fromCharCode(...bytes.slice(1, 4)) === 'PNG' &&
    bytes[4] === 13 &&
    bytes[5] === 10 &&
    bytes[6] === 26 &&
    bytes[7] === 10 &&
    String.fromCharCode(...bytes.slice(12, 16)) === 'IHDR'
  ) {
    info = {
      type: 'image/png',
      width: view.getUint32(16),
      height: view.getUint32(20),
    };
  } else if (bytes.length >= 12 && bytes[0] === 255 && bytes[1] === 216) {
    let offset = 2;
    while (offset + 8 < bytes.length) {
      if (bytes[offset] !== 255) break;
      while (bytes[offset] === 255) offset++;
      const marker = bytes[offset++];
      if (marker === 217 || marker === 218) break;
      if (marker === 1 || (marker >= 208 && marker <= 215)) continue;
      if (offset + 2 > bytes.length) break;
      const length = view.getUint16(offset);
      if (length < 2 || offset + length > bytes.length) break;
      if (
        [
          192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207,
        ].includes(marker) &&
        length >= 8
      ) {
        info = {
          type: 'image/jpeg',
          width: view.getUint16(offset + 5),
          height: view.getUint16(offset + 3),
        };
        break;
      }
      offset += length;
    }
  } else if (
    bytes.length >= 30 &&
    String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  ) {
    const kind = String.fromCharCode(...bytes.slice(12, 16));
    if (kind === 'VP8X') {
      info = {
        type: 'image/webp',
        width: 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16),
        height: 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16),
      };
    } else if (
      kind === 'VP8 ' &&
      bytes[23] === 157 &&
      bytes[24] === 1 &&
      bytes[25] === 42
    ) {
      info = {
        type: 'image/webp',
        width: view.getUint16(26, true) & 0x3fff,
        height: view.getUint16(28, true) & 0x3fff,
      };
    } else if (kind === 'VP8L' && bytes[20] === 47) {
      const packed = view.getUint32(21, true);
      info = {
        type: 'image/webp',
        width: (packed & 0x3fff) + 1,
        height: ((packed >>> 14) & 0x3fff) + 1,
      };
    }
  }
  if (!info || (claimedMime && claimedMime !== info.type))
    throw new Error('Choose a valid PNG, JPG or WebP image.');
  if (
    !info.width ||
    !info.height ||
    info.width > MAX_IMAGE_EDGE ||
    info.height > MAX_IMAGE_EDGE ||
    info.width * info.height > MAX_IMAGE_PIXELS
  )
    throw new Error(
      'This image is too large. Choose an image below 20 megapixels.'
    );
  return info;
}

export function removeEdgeBackground(image: {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}) {
  const { width, height, data } = image;
  const histogram = new Map<
    number,
    { count: number; r: number; g: number; b: number }
  >();
  const perimeter: number[] = [];
  for (let x = 0; x < width; x++) perimeter.push(x, (height - 1) * width + x);
  for (let y = 1; y < height - 1; y++)
    perimeter.push(y * width, y * width + width - 1);
  let visiblePerimeter = 0;
  for (const pixel of perimeter) {
    const i = pixel * 4;
    if (data[i + 3] < 32) continue;
    visiblePerimeter++;
    const key =
      ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4);
    const value = histogram.get(key) ?? { count: 0, r: 0, g: 0, b: 0 };
    value.count++;
    value.r += data[i];
    value.g += data[i + 1];
    value.b += data[i + 2];
    histogram.set(key, value);
  }
  const background = [...histogram.values()].sort(
    (a, b) => b.count - a.count
  )[0];
  if (!background || background.count < visiblePerimeter * 0.6) return;
  const rgb = [background.r, background.g, background.b].map(
    (n) => n / background.count
  );
  const visited = new Uint8Array(width * height);
  const queue = new Uint32Array(width * height);
  let head = 0;
  let tail = 0;
  const add = (pixel: number) => {
    if (visited[pixel]) return;
    visited[pixel] = 1;
    const i = pixel * 4;
    const delta =
      (data[i] - rgb[0]) ** 2 +
      (data[i + 1] - rgb[1]) ** 2 +
      (data[i + 2] - rgb[2]) ** 2;
    // A broad RGB tolerance eats low-contrast foreground (for example dark
    // hair on green). Match transparent antialias fringes to a white/black
    // matte separately, without widening the tolerance for opaque artwork.
    const coverage = data[i + 3] / 255;
    let matches = delta <= 16 ** 2;
    if (!matches && coverage > 0 && coverage < 1) {
      for (const matte of [0, 255]) {
        let projection = 0;
        let magnitude = 0;
        for (let c = 0; c < 3; c++) {
          const direction = matte - rgb[c];
          projection += (data[i + c] - rgb[c]) * direction;
          magnitude += direction ** 2;
        }
        const blend = Math.max(
          0,
          Math.min(1 - coverage + 0.05, magnitude ? projection / magnitude : 0)
        );
        let residual = 0;
        for (let c = 0; c < 3; c++)
          residual += (data[i + c] - (rgb[c] + blend * (matte - rgb[c]))) ** 2;
        if (residual <= 16 ** 2) {
          matches = true;
          break;
        }
      }
    }
    if (coverage && !matches) return;
    data.fill(0, i, i + 4);
    queue[tail++] = pixel;
  };
  for (const pixel of perimeter) add(pixel);
  while (head < tail) {
    const pixel = queue[head++];
    const x = pixel % width;
    if (x) add(pixel - 1);
    if (x < width - 1) add(pixel + 1);
    if (pixel >= width) add(pixel - width);
    if (pixel + width < width * height) add(pixel + width);
  }
}

/** Normalize a raster upload without exposing any vector paths to the browser. */
export async function prepareImagePng(file: File): Promise<string> {
  if (!file.size || file.size > MAX_FILE_BYTES)
    throw new Error('Choose an image smaller than 10 MB.');
  const info = inspectRaster(
    new Uint8Array(await file.arrayBuffer()),
    file.type
  );
  const image = await createImageBitmap(file);
  try {
    if (!(
      (image.width === info.width && image.height === info.height) ||
      (image.width === info.height && image.height === info.width)
    ))
      throw new Error('The image dimensions could not be verified.');
    const scale = Math.min(1, 512 / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext('2d');
    if (!context)
      throw new Error('Your browser could not open the image canvas.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png').split(',')[1]!;
  } finally {
    image.close();
  }
}

export async function vectorizeImage(
  file: File,
  options: { colors: number; removeBackground: boolean }
): Promise<string> {
  if (typeof window === 'undefined' || typeof document === 'undefined')
    throw new Error('Image conversion is available in your browser.');
  if (!file.size || file.size > MAX_FILE_BYTES)
    throw new Error('Choose an image smaller than 10 MB.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const info = inspectRaster(bytes, file.type);
  const image = await createImageBitmap(file).catch(() => {
    throw new Error(
      'This image could not be opened. Try another PNG, JPG or WebP.'
    );
  });
  try {
    if (!(
      (image.width === info.width && image.height === info.height) ||
      (image.width === info.height && image.height === info.width)
    ))
      throw new Error('The image dimensions could not be verified.');
    const scale = Math.min(1, TRACE_EDGE / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context)
      throw new Error('Your browser could not open the image canvas.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    if (options.removeBackground) removeEdgeBackground(pixels);
    // Yield once so the UI paints its busy state before the bounded CPU work.
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve())
    );
    const svg = await traceRaster(pixels, options.colors);
    const safe = sanitizeSVG(svg).replace(
      /<path\b(?=[^>]*\bopacity="0(?:\.0+)?")[^>]*\/>/g,
      ''
    );
    if (!getSvgStats(safe).paths)
      throw new Error(
        'No visible shapes were found. Try an image with stronger contrast.'
      );
    return safe;
  } finally {
    image.close();
  }
}
