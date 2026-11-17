import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { envConfigs } from '../src/config';
import { brandName } from '../src/config/brand';
import { productPageHead } from '../src/lib/seo';
import { m } from '../src/paraglide/messages.js';

test('every branded message interpolates the single configured product name', async () => {
  const messages = JSON.parse(
    await readFile(new URL('../messages/en.json', import.meta.url), 'utf8')
  );
  assert.match(brandName, /^[A-Za-z][A-Za-z ]+$/);
  assert.equal(envConfigs.app_name, brandName);
  for (const [key, value] of Object.entries(messages)) {
    assert.doesNotMatch(String(value), /BRAND/);
    if (!String(value).includes('{brand}')) continue;
    const fn = (m as Record<string, unknown>)[key] as (input: {
      brand: string;
    }) => string;
    const output = fn({ brand: brandName });
    assert.ok(output.includes(brandName), key);
    assert.doesNotMatch(output, /\{.*brand.*\}/i, key);
  }
});

test('metadata and structured identity use the same brand without duplicate suffixes', () => {
  const title = `AI SVG Generator from Text & Images | ${brandName}`;
  const result = productPageHead({
    path: '/',
    title,
    description: `Editable SVG with ${brandName}.`,
    application: true,
    breadcrumb: 'Home',
  });
  assert.equal(result.meta[0].title, title);
  for (const key of ['og:title', 'og:image:alt', 'twitter:title']) {
    const entry = result.meta.find(
      (item) =>
        ('property' in item && item.property === key) ||
        ('name' in item && item.name === key)
    );
    assert.equal(
      entry && 'content' in entry ? entry.content : undefined,
      title
    );
  }
  const graph = JSON.parse(result.scripts[0].children)['@graph'];
  assert.equal(
    graph.find((item: any) => item['@type'] === 'WebSite').name,
    brandName
  );
  assert.equal(
    graph.find((item: any) => item['@type'] === 'WebApplication').name,
    brandName
  );
  assert.equal(
    graph.find((item: any) => item['@type'] === 'BreadcrumbList')
      .itemListElement[0].name,
    brandName
  );
  assert.equal(
    productPageHead({ path: '/pricing', title: 'Pricing', description: '' })
      .meta[0].title,
    `Pricing | ${brandName}`
  );
});
