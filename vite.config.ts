import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import { paraglideVitePlugin } from '@inlang/paraglide-js';
import mdx from '@mdx-js/rollup';
import tailwindcss from '@tailwindcss/vite';
import viteReact from '@vitejs/plugin-react';
import { nitro } from 'nitro/vite';
import { defineConfig, type Plugin } from 'vite';

import { loadEnvFiles } from './src/lib/env.ts';

// Populate process.env from .env.local / .env.{NODE_ENV} / .env for the
// dev server and build process (Vite only exposes VITE_* via import.meta.env;
// server code reads secrets from process.env). In production, env comes
// from the actual host/container environment.
loadEnvFiles();

// Cloudflare Workers build (pnpm cf:build / cf:deploy): stub out unused DB
// drivers — mysql2 crashes workerd at module evaluation (node:net,
// node:process requires); postgres.js runs fine under nodejs_compat but is
// dead weight when the backend is D1. Which driver the bundle keeps follows
// wrangler.jsonc `vars.DATABASE_PROVIDER` (the runtime truth on workerd) —
// d1 stubs both, postgresql keeps postgres.js for the Hyperdrive binding.
const isCloudflareBuild = (process.env.NITRO_PRESET || '').includes(
  'cloudflare'
);
const driverStub = fileURLToPath(
  new URL('./src/core/db/driver-stub.ts', import.meta.url)
);

// Prefer wrangler.jsonc over the build-time env, which can be polluted by
// .env.local (e.g. DATABASE_PROVIDER=sqlite for local dev).
function workersDbProvider(): string {
  try {
    const raw = readFileSync(
      new URL('./wrangler.jsonc', import.meta.url),
      'utf8'
    );
    const m = raw.match(/"DATABASE_PROVIDER"\s*:\s*"([^"]+)"/);
    if (m) return m[1];
  } catch {
    // no wrangler.jsonc yet (fresh clone) — fall through
  }
  return process.env.DATABASE_PROVIDER || 'd1';
}

const workersDb = isCloudflareBuild ? workersDbProvider() : '';
const keepPostgres = workersDb === 'postgresql' || workersDb === 'postgres';
const buildId =
  process.env.VITE_BUILD_ID ||
  (() => {
    try {
      return execFileSync('git', ['rev-parse', '--short=12', 'HEAD'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
    } catch {
      return 'development';
    }
  })();

// Vite runs in Node rather than workerd. Proxy the configured D1 binding so
// development can use the same database as Workers when `remote: true` is set.
function cloudflareDevBindings(): Plugin {
  return {
    name: 'cloudflare-dev-bindings',
    apply: 'serve',
    async configureServer(server) {
      if (process.env.DATABASE_PROVIDER !== 'd1' || isCloudflareBuild) return;

      const { getPlatformProxy } = await import('wrangler');
      const platform = await getPlatformProxy({
        configPath: 'wrangler.jsonc',
        remoteBindings: true,
        persist: false,
      });
      if (!platform.env.DB) {
        await platform.dispose();
        throw new Error('Configure the D1 binding named DB in wrangler.jsonc.');
      }

      const globals = globalThis as typeof globalThis & {
        __CF_ENV__?: Record<string, unknown>;
      };
      const bindings = { DB: platform.env.DB };
      globals.__CF_ENV__ = bindings;
      server.httpServer?.once('close', () => {
        if (globals.__CF_ENV__ === bindings) delete globals.__CF_ENV__;
        void platform.dispose().catch((error: unknown) => {
          server.config.logger.error(String(error));
        });
      });
      server.config.logger.info('D1 development binding connected.');
    },
  };
}

export default defineConfig({
  define: {
    'import.meta.env.VITE_BUILD_ID': JSON.stringify(
      buildId.trim().slice(0, 191)
    ),
  },
  server: {
    port: 3000,
    // Cloud sandboxes (ShipAny Code / e2b) proxy the dev server through a
    // per-sandbox subdomain; without this Vite's host check blocks the
    // preview with "Blocked request. This host is not allowed."
    allowedHosts: ['.e2b.app'],
  },
  resolve: {
    tsconfigPaths: true,
    alias: isCloudflareBuild
      ? {
          mysql2: driverStub,
          ...(keepPostgres ? {} : { postgres: driverStub }),
        }
      : {},
  },
  plugins: [
    cloudflareDevBindings(),
    // MDX must run before the react plugin so JSX in compiled MDX gets transformed.
    // .claude/ holds agent skills served verbatim (`?raw`) — never compile them.
    {
      enforce: 'pre',
      ...mdx({
        providerImportSource: '@mdx-js/react',
        exclude: /\/\.claude\//,
      }),
    },
    tailwindcss(),
    paraglideVitePlugin({
      project: './project.inlang',
      outdir: './src/paraglide',
      outputStructure: 'message-modules',
      strategy: ['url', 'baseLocale'],
      urlPatterns: [
        // API endpoints are never locale-prefixed.
        {
          pattern: '/api/:path(.*)?',
          localized: [['en', '/api/:path(.*)?']],
        },
        // English is served without a locale prefix.
        {
          pattern: '/',
          localized: [['en', '/']],
        },
        // Keep all English page URLs locale-free.
        {
          pattern: '/:path(.*)?',
          localized: [['en', '/:path(.*)?']],
        },
      ],
    }),
    tanstackStart({
      srcDirectory: 'src',
    }),
    viteReact(),
    nitro({
      // Resvg needs a precompiled WebAssembly.Module in Workers. Let Nitro's
      // native WASM plugin emit the binary and its module import together.
      rollupConfig: isCloudflareBuild
        ? {
            plugins: [
              {
                name: 'resvg-compiled-module',
                resolveId: {
                  order: 'pre',
                  handler(source: string, importer?: string) {
                    if (
                      source.endsWith('resvg.wasm') &&
                      importer?.includes('@cf-wasm/resvg')
                    ) {
                      return (
                        fileURLToPath(
                          new URL(
                            './node_modules/@cf-wasm/resvg/dist/lib/resvg.wasm',
                            import.meta.url
                          )
                        ) + '?module'
                      );
                    }
                  },
                },
              },
            ],
          }
        : undefined,
      // Node deployments serve these directly; Workers negotiate compression
      // through Cloudflare's asset service.
      compressPublicAssets: isCloudflareBuild
        ? false
        : { gzip: true, brotli: true },
      // The D1 proxy is a live object in Vite's process. Keep the dev server
      // in that process too so its request handlers can access the binding.
      devServer: {
        runner: process.env.DATABASE_PROVIDER === 'd1' ? 'self' : undefined,
      },
    }),
  ],
  ssr: { external: ['@cf-wasm/resvg'] },
});
