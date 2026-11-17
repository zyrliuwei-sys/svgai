import assert from 'node:assert/strict';
import { test } from 'node:test';

import { SVG_SAMPLES } from '../src/lib/svg-samples';
import {
  getSvgStats,
  inspectRaster,
  outlineSvg,
  recolorSvg,
  sanitizeSVG,
  svgToDataUrl,
} from '../src/lib/svg-vectorizer';

const square =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80"><path fill="#f80" d="M0 0h120v80H0z"/></svg>';

test('samples are real bounded vector artwork and can be exported on SSR', () => {
  assert.equal(SVG_SAMPLES.length, 4);
  assert.equal(new Set(SVG_SAMPLES.map((sample) => sample.id)).size, 4);
  for (const sample of SVG_SAMPLES) {
    const stats = getSvgStats(sample.svg);
    assert.ok(stats.paths >= 8 && stats.paths <= 25, sample.id);
    assert.equal(stats.width, 512);
    assert.equal(stats.height, 512);
    assert.ok(stats.colors.length >= 3, sample.id);
    assert.ok(!/<image|<script|<foreignObject/.test(sample.svg));
    assert.ok(
      svgToDataUrl(sample.svg).startsWith('data:image/svg+xml;charset=utf-8,')
    );
  }
});

test('sanitizer rejects executable elements, external resources and encoded payloads', () => {
  const unsafe = [
    '<svg><script>alert(1)</script></svg>',
    '<svg><image href="https://example.com/tracker.png"/></svg>',
    '<svg><foreignObject><div>HTML</div></foreignObject></svg>',
    '<svg><animate attributeName="href"/></svg>',
    '<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]><svg/>',
    '<svg><path fill="&#106;avascript:alert(1)" d="M0 0z"/></svg>',
    '<svg><path d="M0 0z"></svg>',
    '<svg/><svg/>',
    '<svg><path d="M0 0z" d="M1 1z"/></svg>',
    '<svg viewBox="0 0 -512 512"/>',
    '<svg><path d="M0 0L1e999 2z"/></svg>',
  ];
  for (const svg of unsafe) assert.throws(() => sanitizeSVG(svg), Error, svg);
});

test('provider XML whitespace references preserve geometry without decoding executable entities', () => {
  const safe = sanitizeSVG(
    '<svg viewBox="0 0 1024 768">&#xA;<g fill="#ff7049">&#10;<path d="M0&#x09;0L10 10Z"/>&#13;</g>&#X000A;</svg>'
  );
  assert.equal(getSvgStats(safe).paths, 1);
  assert.equal(getSvgStats(safe).width, 1024);
  assert.match(safe, /d="M0 0L10 10Z"/);
  assert.ok(!safe.includes('&'));
  for (const payload of [
    '&#60;script&#62;',
    '&amp;#xA;',
    '&#x26;',
    '&newline;',
    '&#0;',
  ]) {
    assert.throws(() =>
      sanitizeSVG(`<svg>${payload}<path d="M0 0L10 10Z"/></svg>`)
    );
  }
});

test('sanitizer removes event, CSS, URL and unsupported attribute channels', () => {
  const safe = sanitizeSVG(
    '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0L10 10z" onload="alert(1)" style="fill:url(https://example.com)" href="javascript:alert(1)" fill="url(https://example.com)"/></svg>'
  );
  assert.equal(
    safe,
    '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0L10 10z"/></svg>'
  );
});

test('recoloring changes exact paint values and preserves geometry', () => {
  const changed = recolorSvg(square, '#ff8800', '#3155b5');
  assert.equal(getSvgStats(changed).colors[0], '#3155b5');
  assert.match(changed, /d="M0 0h120v80H0z"/);
  assert.equal(getSvgStats(changed).width, 120);
  assert.equal(getSvgStats(changed).height, 80);
  assert.throws(() => recolorSvg(square, '#f80', 'url(https://example.com)'));
});

test('outline export adds fixed-width strokes and no shape fills', () => {
  const outline = outlineSvg(square);
  assert.match(outline, /fill="none"/);
  assert.match(outline, /vector-effect="non-scaling-stroke"/);
  assert.match(outline, /stroke="#3155b5"/);
  assert.equal(getSvgStats(outline).paths, 1);
});

function png(width: number, height: number) {
  const bytes = new Uint8Array(24);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10], 0);
  bytes.set([73, 72, 68, 82], 12);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}

test('raster inspection checks signatures, MIME consistency and decompression dimensions', () => {
  assert.deepEqual(inspectRaster(png(512, 256), 'image/png'), {
    type: 'image/png',
    width: 512,
    height: 256,
  });
  assert.throws(() => inspectRaster(png(512, 256), 'image/jpeg'));
  assert.throws(() => inspectRaster(png(16_000, 16_000), 'image/png'));
  assert.throws(() => inspectRaster(png(6000, 6000), 'image/png'));
  assert.throws(() =>
    inspectRaster(
      new TextEncoder().encode('<svg onload="alert(1)"/>'),
      'image/svg+xml'
    )
  );
  assert.throws(() => inspectRaster(new Uint8Array([137, 80, 78, 71])));
});

test('WebP extended and lossless dimensions are inspected before bitmap decode', () => {
  const bytes = new Uint8Array(30);
  bytes.set(new TextEncoder().encode('RIFF'), 0);
  bytes.set(new TextEncoder().encode('WEBP'), 8);
  bytes.set(new TextEncoder().encode('VP8X'), 12);
  bytes[24] = 255;
  bytes[27] = 127;
  assert.deepEqual(inspectRaster(bytes), {
    type: 'image/webp',
    width: 256,
    height: 128,
  });
  bytes.set(new TextEncoder().encode('VP8L'), 12);
  bytes[20] = 47;
  new DataView(bytes.buffer).setUint32(21, 127 | (63 << 14), true);
  assert.deepEqual(inspectRaster(bytes), {
    type: 'image/webp',
    width: 128,
    height: 64,
  });
});

test('ImageTracer produces actual path geometry accepted by the export dialect', async () => {
  // @ts-expect-error ImageTracerJS does not publish TypeScript declarations.
  const imported = await import('imagetracerjs');
  const tracer = imported.default ?? imported;
  const width = 32;
  const height = 32;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const foreground = x > 8 && x < 24 && y > 4 && y < 28;
      data.set(foreground ? [220, 80, 40, 255] : [240, 240, 240, 255], i);
    }
  }
  const result: string = tracer.imagedataToSVG(
    { data, width, height },
    {
      numberofcolors: 4,
      colorsampling: 2,
      pathomit: 2,
      viewbox: true,
      roundcoords: 2,
      strokewidth: 0,
    }
  );
  const safe = sanitizeSVG(result);
  const stats = getSvgStats(safe);
  assert.ok(stats.paths >= 2);
  assert.equal(stats.width, width);
  assert.equal(stats.height, height);
  assert.ok(stats.colors.every((color) => /^#[0-9a-f]{6}$/.test(color)));
  assert.ok(!safe.includes('<image'));
});
