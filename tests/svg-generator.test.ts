import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import {
  generateSvg,
  MAX_SVG_BYTES,
  parseSvgInput,
  selectSvgProvider,
  SvgGenerationError,
  validateGeneratedSvg,
} from '../src/modules/svg-generator/service';

const simple =
  '<svg viewBox="0 0 512 512"><path fill="#d45332" d="M0 0L50 0L20 30Z"/></svg>';
const validInput = {
  prompt: 'A simple botanical emblem',
  style: 'illustration',
  aspect: '1:1',
} as const;
const provider = {
  kind: 'openai',
  apiKey: 'test-secret',
  baseUrl: 'https://example.test/v1',
  model: 'test-model',
} as const;
const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});
const errorCode = (code: string) => (error: unknown) =>
  error instanceof SvgGenerationError && error.code === code;

test('generation input is bounded and accepts only known options', () => {
  assert.equal(
    parseSvgInput({ ...validInput, prompt: '  A flower  ' }).prompt,
    'A flower'
  );
  for (const input of [
    null,
    [],
    { ...validInput, prompt: '' },
    { ...validInput, prompt: ' '.repeat(10) },
    { ...validInput, prompt: 'x'.repeat(1601) },
    { ...validInput, style: 'script' },
    { ...validInput, aspect: '8:9' },
  ]) {
    assert.throws(() => parseSvgInput(input), errorCode('invalid_input'));
  }
});

test('provider requires explicit administration settings and preserves provider boundaries', () => {
  const previous = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'ambient-must-not-be-used';
  try {
    assert.equal(selectSvgProvider({}), undefined);
    assert.equal(selectSvgProvider({ openai_api_key: '********' }), undefined);
    assert.equal(selectSvgProvider({ openai_api_key: '   ' }), undefined);
    const anthropic = selectSvgProvider({
      anthropic_api_key: 'test-anthropic',
    });
    assert.equal(anthropic?.kind, 'anthropic');
    assert.equal(anthropic?.baseUrl, 'https://api.anthropic.com');
    assert.equal(
      selectSvgProvider({
        openai_api_key: 'test-openai',
        anthropic_api_key: 'test-anthropic',
      })?.kind,
      'openai'
    );
  } finally {
    if (previous === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previous;
  }
});

test('safe vector XML is rebuilt with namespace and retains paths and local gradients', () => {
  const result = validateGeneratedSvg(simple);
  assert.match(result, /^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/);
  assert.match(result, /<path fill="#d45332"/);
  assert.equal(validateGeneratedSvg('```svg\n' + simple + '\n```'), result);
  assert.doesNotThrow(() =>
    validateGeneratedSvg(
      '<svg viewBox="0 0 20 20"><defs><linearGradient id="paint"><stop offset="0%" stop-color="#f00"/><stop offset="100%" stop-color="#00f"/></linearGradient></defs><rect x="0" y="0" width="20" height="20" fill="url(#paint)"/></svg>'
    )
  );
});

test('active content, raster wrappers and external references fail closed', () => {
  const payloads = [
    '<script>alert(1)</script>',
    '<foreignObject><p>HTML</p></foreignObject>',
    '<image href="https://example.test/tracker.png"/>',
    '<use href="https://example.test/code.svg#x"/>',
    '<animate attributeName="href" values="javascript:alert(1)"/>',
    '<style>path{fill:url(https://example.test)}</style>',
    '<path onload="alert(1)" d="M0 0L1 1"/>',
    '<path fill="url(https://example.test)" d="M0 0L1 1"/>',
    '<path fill="url(data:image/svg+xml,x)" d="M0 0L1 1"/>',
    '<path style="fill:red" d="M0 0L1 1"/>',
    '<path d="M0 0L1 1" data-url="https://example.test"/>',
    '<path d="M0 0L1 1" fill="&#x72;ed"/>',
    '<path d="M0 0L1 1" fill="red" fill="blue"/>',
    '<g xmlns="http://www.w3.org/1999/xhtml"><path d="M0 0L1 1"/></g>',
    '<svg viewBox="0 0 10 10"><rect width="10" height="10"/></svg>',
    '<!-- hidden -->',
    '<![CDATA[<path d="M0 0L1 1"/>]]>',
    '<path d="M0 0L1 1"/><!DOCTYPE svg>',
  ];
  for (const payload of payloads)
    assert.throws(
      () => validateGeneratedSvg(`<svg viewBox="0 0 20 20">${payload}</svg>`),
      errorCode('invalid_svg'),
      payload
    );
});

test('malformed, empty, oversized and excessively nested SVG is rejected', () => {
  for (const payload of [
    '<svg viewBox="0 0 20 20"></svg>',
    '<svg><path d="M0 0L1 1"/></svg>',
    '<svg viewBox="0 0 0 0"><path d="M0 0L1 1"/></svg>',
    '<svg viewBox="0 0 20 20"><g><path d="M0 0L1 1"/></svg>',
    simple + simple,
    '<?xml version="1.0"?>' + simple,
    simple + 'x',
    '<svg viewBox="0 0 20 20">' +
      '<g>'.repeat(35) +
      '<path d="M0 0L1 1"/>' +
      '</g>'.repeat(35) +
      '</svg>',
    ' '.repeat(MAX_SVG_BYTES) + simple,
    '<svg viewBox="0 0 20 20">' +
      '<path d="M0 0L1 1"/>'.repeat(2001) +
      '</svg>',
  ])
    assert.throws(
      () => validateGeneratedSvg(payload),
      errorCode('invalid_svg')
    );
});

test('OpenAI generation uses the configured model and validates provider output', async () => {
  let observed: Record<string, any> = {};
  globalThis.fetch = (async (url, init) => {
    observed = {
      url: String(url),
      ...JSON.parse(String(init?.body)),
      headers: init?.headers,
      redirect: init?.redirect,
    };
    return Response.json({ choices: [{ message: { content: simple } }] });
  }) as typeof fetch;
  const result = await generateSvg(validInput, provider);
  assert.equal(result.svg, validateGeneratedSvg(simple));
  assert.equal(observed.url, 'https://example.test/v1/chat/completions');
  assert.equal(observed.model, 'test-model');
  assert.equal(observed.redirect, 'manual');
  assert.ok(
    observed.messages.some((m: any) => m.content.includes('botanical'))
  );
});

test('Anthropic generation uses its dedicated authentication and message format', async () => {
  let observed: Record<string, any> = {};
  globalThis.fetch = (async (url, init) => {
    observed = {
      url: String(url),
      ...JSON.parse(String(init?.body)),
      headers: init?.headers,
    };
    return Response.json({ content: [{ type: 'text', text: simple }] });
  }) as typeof fetch;
  await generateSvg(validInput, {
    ...provider,
    kind: 'anthropic',
    baseUrl: 'https://example.test',
  });
  assert.equal(observed.url, 'https://example.test/v1/messages');
  assert.equal(observed.headers['x-api-key'], 'test-secret');
  assert.equal(observed.headers.Authorization, undefined);
  assert.ok(observed.system.includes('vector illustrator'));
});

test('provider failures never echo response bodies or credentials', async () => {
  globalThis.fetch = (async () =>
    Response.json(
      { error: { message: 'test-secret and private prompt' } },
      { status: 403 }
    )) as typeof fetch;
  await assert.rejects(
    generateSvg(validInput, provider),
    (error: unknown) =>
      error instanceof SvgGenerationError &&
      error.code === 'provider_failed' &&
      !error.message.includes('test-secret')
  );
  globalThis.fetch = (async () =>
    Response.json({
      choices: [{ message: { content: '<svg><script>bad()</script></svg>' } }],
    })) as typeof fetch;
  await assert.rejects(
    generateSvg(validInput, provider),
    errorCode('invalid_svg')
  );
});

test('provider endpoints cannot downgrade to HTTP or carry embedded credentials', async () => {
  let called = false;
  globalThis.fetch = (async () => {
    called = true;
    return Response.json({});
  }) as typeof fetch;
  for (const baseUrl of [
    'http://example.test/v1',
    'https://user:password@example.test/v1',
    'https://example.test/v1?secret=value',
  ]) {
    await assert.rejects(
      generateSvg(validInput, { ...provider, baseUrl }),
      errorCode('provider_failed')
    );
  }
  assert.equal(called, false);
});
