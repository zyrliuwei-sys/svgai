import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { test } from 'node:test';

import { R2Provider } from '../src/core/storage/r2';

test('R2 uploads preserve binary bytes with the Wrangler proxy dispatcher', async () => {
  // Wrangler installs this dispatcher when a proxy is present. The local
  // endpoint bypasses the deliberately unreachable proxy; no cloud access
  // or real credentials are needed for this transport regression.
  const names = ['http_proxy', 'https_proxy', 'no_proxy', 'NO_PROXY'] as const;
  const previous = Object.fromEntries(
    names.map((name) => [name, process.env[name]])
  );
  process.env.http_proxy = process.env.https_proxy = 'http://127.0.0.1:9';
  process.env.no_proxy = process.env.NO_PROXY = 'localhost,127.0.0.1';
  let received: { path?: string; type?: string; body: Buffer } | undefined;
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    received = {
      path: request.url,
      type: request.headers['content-type'],
      body: Buffer.concat(chunks),
    };
    response.writeHead(200, { ETag: '"test-upload"' });
    response.end();
  });
  try {
    await import('wrangler');
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const provider = new R2Provider({
      accountId: 'test-account',
      accessKeyId: 'test-access-key',
      secretAccessKey: 'test-secret-key',
      bucket: 'svgai',
      endpoint: `http://127.0.0.1:${address.port}`,
      publicDomain: 'https://cdn.example.test',
    });
    const bytes = new Uint8Array([0, 255, 128, 10, 13, 42]);
    const result = await provider.uploadFile({
      body: bytes,
      key: 'binary.png',
      contentType: 'image/png',
    });
    assert.equal(result.success, true, result.error);
    assert.ok(received);
    assert.equal(received.path, '/svgai/uploads/binary.png');
    assert.equal(received.type, 'image/png');
    assert.deepEqual(received.body, Buffer.from(bytes));
    assert.equal(result.url, 'https://cdn.example.test/uploads/binary.png');
  } finally {
    server.closeAllConnections();
    if (server.listening)
      await new Promise<void>((resolve) => server.close(() => resolve()));
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  }
});
