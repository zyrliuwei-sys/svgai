import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@cf-wasm/resvg';

import { brandName } from '../src/config/brand.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const escapeXml = (value) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&apos;',
      })[char]
  );
const writeChanged = (path, value) => {
  const next = Buffer.from(value);
  let current;
  try {
    current = readFileSync(path);
  } catch {
    /* New generated asset. */
  }
  if (!current?.equals(next)) writeFileSync(path, next);
};

for (const name of [
  'wordmark.svg',
  'wordmark-reverse.svg',
  'social-card.svg',
]) {
  const path = resolve(root, 'public/brand', name);
  const source = readFileSync(path, 'utf8');
  const updated = source.replace(
    /(<text\b[^>]*\bdata-brand-name="true"[^>]*>)[\s\S]*?(<\/text>)/g,
    (_, open, close) => open + escapeXml(brandName) + close
  );
  writeChanged(path, updated);
}

const renderer = await Resvg.async(
  readFileSync(resolve(root, 'public/brand/social-card.svg'), 'utf8'),
  {
    font: {
      fontBuffers: [
        readFileSync(
          resolve(
            root,
            'node_modules/@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-wght-normal.woff2'
          )
        ),
      ],
      defaultFontFamily: 'Bricolage Grotesque',
    },
  }
);
try {
  const image = renderer.render();
  try {
    writeChanged(resolve(root, 'public/brand/social-card.png'), image.asPng());
  } finally {
    image.free();
  }
} finally {
  renderer.free();
}
console.log('Brand assets generated from src/config/brand.ts.');
