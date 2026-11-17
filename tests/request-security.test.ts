import assert from 'node:assert/strict';
import { test } from 'node:test';

import { escapeHtml } from '../src/lib/html';
import {
  readRequestBytes,
  RequestBodyTooLargeError,
} from '../src/lib/request-body';
import {
  isPrivatePath,
  isSameOriginRequest,
  secureResponse,
} from '../src/lib/request-security';

test('account names cannot inject markup into password-reset emails', () => {
  const name = '<a href="https://evil.example">Support</a> & \'Admin\'';
  assert.equal(
    escapeHtml(name),
    '&lt;a href=&quot;https://evil.example&quot;&gt;Support&lt;/a&gt; &amp; &#39;Admin&#39;'
  );
});

test('cookie writes reject foreign, null and missing origins while allowing the public proxy origin', () => {
  const request = (headers: Record<string, string>) =>
    new Request('http://internal:3000/api/user/profile', { headers });
  const site = 'https://product.example';
  assert.equal(isSameOriginRequest(request({ origin: site }), site), true);
  assert.equal(
    isSameOriginRequest(request({ origin: 'http://internal:3000' }), site),
    true
  );
  assert.equal(
    isSameOriginRequest(request({ 'sec-fetch-site': 'same-origin' }), site),
    true
  );
  const rejected: Record<string, string>[] = [
    { origin: 'https://evil.example' },
    { origin: 'https://product.example.evil.example' },
    { origin: 'null' },
    { origin: site, 'sec-fetch-site': 'cross-site' },
    {},
  ];
  for (const headers of rejected)
    assert.equal(isSameOriginRequest(request(headers), site), false);
});

test('private routes and error pages cannot be cached or indexed; cookies survive immutable redirects', () => {
  for (const path of [
    '/admin/users',
    '/settings',
    '/api/svg/generate',
    '/verify-email',
  ]) {
    assert.equal(isPrivatePath(path), true);
    const response = secureResponse(
      Response.redirect('https://product.example/sign-in'),
      path
    );
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
    assert.equal(
      response.headers.get('location'),
      'https://product.example/sign-in'
    );
  }
  const response = new Response('ok', {
    headers: {
      'x-powered-by': 'internal',
      'set-cookie': 'session=opaque; HttpOnly',
    },
  });
  const publicResponse = secureResponse(response, '/pricing');
  assert.equal(publicResponse.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(
    publicResponse.headers.get('set-cookie'),
    'session=opaque; HttpOnly'
  );
  assert.equal(publicResponse.headers.has('x-powered-by'), false);
  assert.equal(publicResponse.headers.has('x-robots-tag'), false);
  assert.equal(
    secureResponse(
      new Response('missing', { status: 404 }),
      '/missing'
    ).headers.get('x-robots-tag'),
    'noindex, nofollow'
  );
});

test('the upload body limit stops chunked input even without a Content-Length header', async () => {
  let canceled = false;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      controller.enqueue(new Uint8Array(8));
    },
    cancel() {
      canceled = true;
    },
  });
  const request = new Request(
    'https://product.example/api/storage/upload-image',
    { method: 'POST', body: stream, duplex: 'half' } as RequestInit
  );
  await assert.rejects(readRequestBytes(request, 10), RequestBodyTooLargeError);
  assert.equal(canceled, true);
  const valid = new Request('https://product.example', {
    method: 'POST',
    body: 'hello',
  });
  assert.equal(
    new TextDecoder().decode(await readRequestBytes(valid, 5)),
    'hello'
  );
  const oversized = new Request('https://product.example', {
    method: 'POST',
    body: 'hello',
    headers: { 'content-length': '500' },
  });
  await assert.rejects(
    readRequestBytes(oversized, 10),
    RequestBodyTooLargeError
  );
});
