export interface TracePixels {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

interface TraceColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** Sample the whole image rather than a grid that can miss small color regions. */
function tracePalette(image: TracePixels, colorLimit: number): TraceColor[] {
  const { data } = image;
  let visible = 0;
  let opaque = 0;
  let transparent = false;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) {
      // Invisible RGB must not consume colors or distort their averages.
      data.fill(0, i, i + 4);
      transparent = true;
    } else {
      visible++;
      if (data[i + 3] === 255) opaque++;
    }
  }

  // Thin antialias fringes need not become additional paint colors. Preserve
  // alpha in the palette when translucency is a substantial part of the image.
  const solidArtwork = opaque >= visible * 0.95;
  const histogram = new Map<number, TraceColor & { count: number }>();
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a === 0 || (solidArtwork && a !== 255)) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const key = ((r >> 3) << 12) | ((g >> 3) << 7) | ((b >> 3) << 2) | (a >> 6);
    const bucket = histogram.get(key) ?? { r: 0, g: 0, b: 0, a: 0, count: 0 };
    bucket.r += r;
    bucket.g += g;
    bucket.b += b;
    bucket.a += a;
    bucket.count++;
    histogram.set(key, bucket);
  }

  const candidates = [...histogram.values()]
    .map((color) => ({
      r: Math.round(color.r / color.count),
      g: Math.round(color.g / color.count),
      b: Math.round(color.b / color.count),
      a: Math.round(color.a / color.count),
      count: color.count,
      distance: Infinity,
    }))
    .sort((a, b) => b.count - a.count);
  const selected: TraceColor[] = [];
  let next = candidates[0];
  while (next && selected.length < colorLimit) {
    selected.push({ r: next.r, g: next.g, b: next.b, a: next.a });
    let best: typeof next | undefined;
    let score = 0;
    for (const color of candidates) {
      color.distance = Math.min(
        color.distance,
        (color.r - next.r) ** 2 +
          (color.g - next.g) ** 2 +
          (color.b - next.b) ** 2 +
          (color.a - next.a) ** 2
      );
      const importance = color.distance * color.count;
      if (color.distance > 16 ** 2 && importance > score) {
        best = color;
        score = importance;
      }
    }
    // The color setting is a maximum. Do not fill unused slots with edge
    // shades that create hundreds of specks around otherwise flat artwork.
    if (!best || (score < visible * 32 && best.count < visible * 0.005)) break;
    next = best;
  }
  if (transparent) selected.unshift({ r: 0, g: 0, b: 0, a: 0 });
  return selected;
}

/** Shared settings for server conversion and the browser tracing helper. */
export function imageTraceOptions(image: TracePixels, colors: number) {
  const limit = Math.min(24, Math.max(2, Math.round(colors) || 8));
  return {
    pal: tracePalette(image, limit),
    // Fixed colors avoid averaging transparent edge pixels into solid fills.
    colorquantcycles: 1,
    ltres: 1.5,
    qtres: 2,
    pathomit: 8,
    rightangleenhance: false,
    linefilter: false,
    layering: 0,
    strokewidth: 0,
    roundcoords: 2,
    viewbox: true,
    desc: false,
  };
}
