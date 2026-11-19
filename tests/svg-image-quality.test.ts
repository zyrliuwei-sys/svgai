import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decode, encode } from 'fast-png';

import { getSvgStats, removeEdgeBackground } from '../src/lib/svg-vectorizer';
import {
  parseImageInput,
  rasterizeSvg,
  traceImage,
} from '../src/server/svg-renderer';

type Pixel = [number, number, number, number];

function artwork(paint: (x: number, y: number) => Pixel, size = 64) {
  const data = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) data.set(paint(x, y), (y * size + x) * 4);
  return { width: size, height: size, data };
}

async function convert(
  pixels: ReturnType<typeof artwork>,
  removeBackground = false
) {
  const png = encode({ ...pixels, channels: 4, depth: 8 });
  const svg = await traceImage(
    parseImageInput({
      image: Buffer.from(png).toString('base64'),
      colors: 4,
      removeBackground,
    })
  );
  const rendered = decode(Buffer.from(await rasterizeSvg(svg), 'base64'));
  return {
    svg,
    at(x: number, y: number): Pixel {
      const px = Math.floor(((x + 0.5) * rendered.width) / pixels.width);
      const py = Math.floor(((y + 0.5) * rendered.height) / pixels.height);
      const i = (py * rendered.width + px) * rendered.channels;
      return Array.from(rendered.data.slice(i, i + 4)) as Pixel;
    },
  };
}

test('removing a green background preserves connected low-contrast dark hair', async () => {
  const background: Pixel = [20, 81, 56, 255];
  const hair: Pixel = [37, 61, 51, 255];
  const pixels = artwork((x, y) => {
    if (x >= 16 && x < 48 && y >= 12 && y < 32) return hair;
    if (x >= 18 && x < 46 && y >= 32 && y < 54) return [244, 197, 151, 255];
    return background;
  });
  const removed = { ...pixels, data: pixels.data.slice() };
  removeEdgeBackground(removed);
  assert.equal(removed.data[(20 * 64 + 32) * 4 + 3], 255);
  assert.equal(removed.data[3], 0);
  const output = await convert(pixels, true);
  assert.deepEqual(output.at(32, 20), hair);
  assert.equal(output.at(0, 0)[3], 0);
});

test('background removal leaves varied image borders and enclosed white regions intact', () => {
  const colors: Pixel[] = [
    [240, 40, 40, 255],
    [40, 240, 40, 255],
    [40, 40, 240, 255],
    [240, 240, 40, 255],
  ];
  const varied = artwork((x, y) => colors[(x < 32 ? 0 : 1) + (y < 32 ? 0 : 2)]);
  const before = varied.data.slice();
  removeEdgeBackground(varied);
  assert.deepEqual(varied.data, before);

  const white: Pixel = [255, 255, 255, 255];
  const enclosed = artwork((x, y) => {
    if (x >= 16 && x < 48 && y >= 16 && y < 48) {
      return x >= 24 && x < 40 && y >= 24 && y < 40 ? white : [30, 40, 50, 255];
    }
    return white;
  });
  removeEdgeBackground(enclosed);
  assert.equal(enclosed.data[3], 0);
  assert.equal(enclosed.data[(32 * 64 + 32) * 4 + 3], 255);
});

test('transparent matte fringes are removed without erasing translucent foreground', () => {
  const pixels = artwork((x, y) => {
    if (y === 0 && x >= 4 && x < 12) return [100, 145, 127, 128];
    if (y === 0 && x >= 28 && x < 36) return [37, 61, 51, 128];
    return [20, 81, 56, 255];
  });
  removeEdgeBackground(pixels);
  assert.equal(pixels.data[6 * 4 + 3], 0);
  assert.equal(pixels.data[30 * 4 + 3], 128);
});

test('a small color region outside the old sampling grid survives conversion', async () => {
  const output = await convert(
    artwork((x, y) =>
      x >= 2 && x < 12 && y >= 2 && y < 12
        ? [230, 40, 20, 255]
        : [255, 255, 255, 255]
    )
  );
  assert.deepEqual(output.at(6, 6), [230, 40, 20, 255]);
  assert.deepEqual(output.at(40, 40), [255, 255, 255, 255]);
  assert.equal(getSvgStats(output.svg).colors.length, 2);
});

test('transparent RGB does not contaminate colors, and translucent artwork retains opacity', async () => {
  for (const alpha of [8, 128, 255]) {
    const output = await convert(
      artwork((x, y) =>
        x >= 12 && x < 52 && y >= 12 && y < 52
          ? [10, 120, 240, alpha]
          : [255, 180, 30, 0]
      )
    );
    assert.ok(Math.abs(output.at(32, 32)[3] - alpha) <= 1);
    assert.equal(output.at(0, 0)[3], 0);
    assert.ok(getSvgStats(output.svg).colors.includes('#0a78f0'));
  }
});

test('flat artwork stays compact and deterministic without redundant antialias colors', async () => {
  const pixels = artwork((x, y) =>
    x >= 16 && x < 48 && y >= 16 && y < 48
      ? [30, 80, 220, 255]
      : [255, 255, 255, 255]
  );
  const first = await convert(pixels);
  const second = await convert(pixels);
  assert.equal(first.svg, second.svg);
  const stats = getSvgStats(first.svg);
  assert.equal(stats.colors.length, 2);
  assert.ok(stats.paths <= 4);
  assert.ok(stats.bytes < 5000);
  assert.doesNotMatch(first.svg, /<image|<script|href=/);
});
