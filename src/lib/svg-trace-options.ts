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

interface ColorSample extends TraceColor {
  count: number;
  distance: number;
}

function rgbBin(r: number, g: number, b: number) {
  return ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
}

/** Sample the whole image rather than a grid that can miss small color regions. */
function tracePalette(image: TracePixels, colorLimit: number) {
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
    const key = (rgbBin(r, g, b) << 2) | (a >> 6);
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
  if (
    opaque === image.width * image.height &&
    candidates.length > 64 &&
    candidates.slice(0, 8).reduce((sum, color) => sum + color.count, 0) <
      opaque * 0.75
  )
    return { palette: photoPalette(candidates, colorLimit), photo: true };
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
  return { palette: selected, photo: false };
}

function photoDistance(r: number, g: number, b: number, color: TraceColor) {
  const dr = r - color.r;
  const dg = g - color.g;
  const db = b - color.b;
  // Distinguish warm subject colors from nearby gray tones of similar brightness.
  return dr * dr + dg * dg + db * db + 4 * ((dr - dg) ** 2 + (dg - db) ** 2);
}

function closestColor(r: number, g: number, b: number, palette: TraceColor[]) {
  let index = 0;
  let distance = Infinity;
  for (let i = 0; i < palette.length; i++) {
    const candidate = photoDistance(r, g, b, palette[i]);
    if (candidate < distance) {
      index = i;
      distance = candidate;
    }
  }
  return index;
}

function photoPalette(samples: ColorSample[], limit: number): TraceColor[] {
  // Square-root weights keep a large backdrop from consuming the whole palette.
  const points = samples.map((sample) => ({
    ...sample,
    weight: Math.sqrt(sample.count),
  }));
  const palette: TraceColor[] = [points[0]];
  while (palette.length < limit) {
    const last = palette[palette.length - 1];
    let best = points[0];
    let score = 0;
    for (const point of points) {
      point.distance = Math.min(
        point.distance,
        photoDistance(point.r, point.g, point.b, last)
      );
      const importance = point.distance * point.weight;
      if (importance > score) {
        score = importance;
        best = point;
      }
    }
    if (!score) break;
    palette.push(best);
  }
  for (let iteration = 0; iteration < 6; iteration++) {
    const sums = palette.map(() => ({ r: 0, g: 0, b: 0, weight: 0 }));
    for (const { r, g, b, weight } of points) {
      const sum = sums[closestColor(r, g, b, palette)];
      sum.r += r * weight;
      sum.g += g * weight;
      sum.b += b * weight;
      sum.weight += weight;
    }
    for (const [i, sum] of sums.entries()) {
      if (sum.weight)
        palette[i] = {
          r: Math.round(sum.r / sum.weight),
          g: Math.round(sum.g / sum.weight),
          b: Math.round(sum.b / sum.weight),
          a: 255,
        };
    }
  }
  return palette;
}

/** Use the same photo and flat-art treatment in both conversion entry points. */
export async function traceRaster(image: TracePixels, colors: number) {
  const limit = Math.min(24, Math.max(2, Math.round(colors) || 8));
  const { palette, photo } = tracePalette(image, limit);
  // @ts-expect-error ImageTracerJS does not publish TypeScript declarations.
  const imported = await import('imagetracerjs');
  const tracer = imported.default ?? imported;
  let pixels = image;
  if (photo) {
    const smoothed = Uint8ClampedArray.from(tracer.blur(image, 2, 40).data);
    const lookup = new Int16Array(32 ** 3).fill(-1);
    for (let i = 0; i < smoothed.length; i += 4) {
      const bin = rgbBin(smoothed[i], smoothed[i + 1], smoothed[i + 2]);
      if (lookup[bin] === -1) {
        // Use each bin's center so assignment does not depend on scan order.
        lookup[bin] = closestColor(
          ((bin >> 10) << 3) + 4,
          (((bin >> 5) & 31) << 3) + 4,
          ((bin & 31) << 3) + 4,
          palette
        );
      }
      const { r, g, b } = palette[lookup[bin]];
      smoothed[i] = r;
      smoothed[i + 1] = g;
      smoothed[i + 2] = b;
      smoothed[i + 3] = 255;
    }
    pixels = { ...image, data: smoothed };
  }
  const svg: string = tracer.imagedataToSVG(pixels, {
    pal: palette,
    // Fixed colors avoid averaging transparent edge pixels into solid fills.
    colorquantcycles: 1,
    ltres: photo ? 1.15 : 1.5,
    qtres: photo ? 1.5 : 2,
    pathomit: photo ? 16 : 8,
    rightangleenhance: false,
    linefilter: false,
    layering: 0,
    strokewidth: photo ? 1.25 : 0,
    roundcoords: photo ? 1 : 2,
    viewbox: true,
    desc: false,
  });
  if (!photo) return svg;
  // An opaque base hides subpixel gaps where independently fitted paths meet.
  const { r, g, b } = palette[0];
  return svg.replace(
    '><path',
    `><rect width="${image.width}" height="${image.height}" fill="rgb(${r},${g},${b})"/><path`
  );
}
