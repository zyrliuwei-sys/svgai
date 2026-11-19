import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

// Use Wrangler's pinned workerd runtime. No real credentials or network calls.
const require = createRequire(import.meta.resolve('wrangler'));
const { Miniflare } = require('miniflare');
const { build } = require('esbuild');
const root = fileURLToPath(new URL('../', import.meta.url));
const key = 'isolated-workers-test-key';
const svg =
  '<svg viewBox="0 0 20 20"><path fill="#f00" d="M0 0L10 0L0 10Z"/></svg>';

test('SVG provider requests work in workerd and never follow redirects with credentials', async (t) => {
  const bundle = await build({
    stdin: {
      contents: `
        import {createSeeApiGeneration, getSeeApiGeneration, downloadSeeApiSvg} from './src/core/ai/seeapi-generation';
        import {testSeeApiConnection} from './src/core/ai/seeapi';
        import {generateSvg} from './src/modules/svg-generator/service';
        const credentials = {apiKey: ${JSON.stringify(key)}, baseUrl: 'https://api.seeapi.com'};
        export default {async fetch(request) {
          try {
            let result;
            switch (new URL(request.url).pathname) {
              case '/runtime':
                new Request('https://api.seeapi.com', {redirect: 'error'});
                return Response.json({unsupportedModeRejected: false});
              case '/connection':
                result = await testSeeApiConnection({seeapi_api_key: credentials.apiKey}); break;
              case '/create':
                result = await createSeeApiGeneration(credentials, {idempotencyKey: 'saved-request', prompt: 'A red triangle', aspect: '1:1'}); break;
              case '/poll':
                result = await getSeeApiGeneration(credentials, 'task_workers'); break;
              case '/asset':
                result = {svg: await downloadSeeApiSvg('https://assets.seeapi.com/result.svg')}; break;
              case '/fallback':
                result = await generateSvg({prompt: 'A red triangle', style: 'icon', aspect: '1:1'}, {kind: 'openai', apiKey: credentials.apiKey, baseUrl: 'https://api.example.test/v1', model: 'test'}); break;
            }
            return Response.json(result);
          } catch (error) {
            return Response.json({error: error.name, status: error.status}, {status: 502});
          }
        }};
      `,
      resolveDir: root,
      sourcefile: 'svg-workers-entry.ts',
      loader: 'ts',
    },
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'browser',
    tsconfig: root + 'tsconfig.json',
  });
  let redirectStatus = 0;
  const calls = [];
  const runtime = new Miniflare({
    cf: false,
    workers: [
      {
        config: {
          name: 'svg-provider-regression',
          compatibilityDate: '2026-10-01',
          manifest: {
            mainModule: 'worker.mjs',
            modules: {
              'worker.mjs': {
                type: 'esm',
                contents: bundle.outputFiles[0].text,
              },
            },
          },
        },
        dev: {
          outboundService: {
            type: 'fetcher',
            handler: async (request) => {
              const url = new URL(request.url);
              calls.push({
                url: request.url,
                authorization: request.headers.get('authorization'),
                method: request.method,
                idempotency: request.headers.get('idempotency-key'),
              });
              if (redirectStatus)
                return new Response(null, {
                  status: redirectStatus,
                  headers: { location: 'https://untrusted.example/collect' },
                });
              if (url.hostname === 'assets.seeapi.com')
                return new Response(svg);
              if (url.hostname === 'api.example.test')
                return Response.json({
                  choices: [{ message: { content: svg } }],
                });
              if (url.pathname === '/v1/credits')
                return Response.json({ total_credit: 100 });
              return Response.json({
                generation: {
                  id: 'task_workers',
                  status:
                    request.method === 'POST' ? 'processing' : 'succeeded',
                  consumed_credits: 10,
                  result: {
                    assets: [
                      {
                        url: 'https://assets.seeapi.com/result.svg',
                        mime_type: 'image/svg+xml',
                      },
                    ],
                  },
                },
              });
            },
          },
        },
      },
    ],
  });
  t.after(() => runtime.dispose());

  await t.test(
    'the production runtime reproduces the original unsupported redirect error',
    async () => {
      const response = await runtime.dispatchFetch(
        'https://test.local/runtime'
      );
      assert.equal(response.status, 502);
      assert.equal((await response.json()).error, 'TypeError');
      assert.equal(calls.length, 0);
    }
  );

  await t.test(
    'connection, submit, poll, native SVG download and fallback provider all complete',
    async () => {
      for (const path of [
        'connection',
        'create',
        'poll',
        'asset',
        'fallback',
      ]) {
        const response = await runtime.dispatchFetch(
          `https://test.local/${path}`
        );
        assert.equal(response.status, 200, path);
        const result = await response.json();
        if (path === 'connection') assert.equal(result.success, true);
        else if (path === 'create') assert.equal(result.status, 'processing');
        else if (path === 'poll') assert.equal(result.status, 'succeeded');
        else assert.match(result.svg, /<path/);
      }
      assert.equal(calls.length, 5);
      assert.equal(calls[1].idempotency, 'saved-request');
      assert.equal(calls[3].authorization, null);
      for (const i of [0, 1, 2, 4])
        assert.equal(calls[i].authorization, `Bearer ${key}`);
    }
  );

  await t.test(
    'redirects are rejected without forwarding credentials or fetching the destination',
    async () => {
      for (const status of [301, 302, 303, 307, 308]) {
        redirectStatus = status;
        for (const path of [
          'connection',
          'create',
          'poll',
          'asset',
          'fallback',
        ]) {
          const before = calls.length;
          const response = await runtime.dispatchFetch(
            `https://test.local/${path}`
          );
          const result = await response.json();
          if (path === 'connection') assert.equal(result.success, false);
          else assert.equal(response.status, 502, `${path}: ${status}`);
          assert.equal(calls.length, before + 1);
          assert.doesNotMatch(JSON.stringify(result), new RegExp(key));
        }
      }
      assert(
        calls.every(
          (call) => new URL(call.url).hostname !== 'untrusted.example'
        )
      );
    }
  );
});
