import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { eq } from 'drizzle-orm';
import { encode } from 'fast-png';

const directory = await mkdtemp(join(tmpdir(), 'svgai-preview-test-'));
Object.assign(process.env, {
  DATABASE_PROVIDER: 'sqlite',
  DATABASE_URL: `file:${directory}/test.db`,
  AUTH_SECRET: 'isolated-svg-preview-secret',
  CONFIG_ENCRYPTION_KEY: '',
  NODE_ENV: 'test',
});
execFileSync(
  process.execPath,
  [
    'node_modules/drizzle-kit/bin.cjs',
    'push',
    '--dialect=sqlite',
    '--schema=./src/config/db/schema.sqlite.ts',
    `--url=${process.env.DATABASE_URL}`,
    '--force',
  ],
  { stdio: 'pipe', env: process.env }
);
let dispose: (() => Promise<void>) | undefined;
if (process.env.ATOMIC_D1 === '1') {
  const { createClient } = await import('@libsql/client');
  const sqlite = createClient({ url: process.env.DATABASE_URL! });
  const ddl = (
    await sqlite.execute(
      "select sql from sqlite_master where sql is not null and name not like 'sqlite_%' and name not like '__drizzle%' order by type='index'"
    )
  ).rows.map((r) => String(r.sql));
  sqlite.close();
  const { getPlatformProxy } = await import('wrangler');
  const platform = await getPlatformProxy<{ DB: any }>({
    configPath: 'wrangler.jsonc',
    remoteBindings: false,
    persist: { path: join(directory, 'd1') },
  });
  for (const statement of ddl) await platform.env.DB.prepare(statement).run();
  (globalThis as any).__CF_ENV__ = platform.env;
  process.env.DATABASE_PROVIDER = 'd1';
  dispose = platform.dispose;
}
const { db } = await import('../src/core/db');
const { user, order, svgPreview, svgPreviewQuota } =
  await import('../src/config/db/schema');
const {
  claimPreview,
  completePreview,
  visitorPreview,
  bindPreview,
  paidSvgOrder,
  clientPreviewUsed,
  PreviewError,
} = await import('../src/modules/svg-previews/service');
const { getBalance, grant } = await import('../src/modules/credits/service');
const { fulfillSvg, findTask, TaskBillingError } =
  await import('../src/modules/ai-tasks/service');
const { setAtomicModeForTests } = await import('../src/core/db/atomic');
setAtomicModeForTests('batch');
const { parseImageInput, traceImage, rasterizeSvg } =
  await import('../src/server/svg-renderer');
const { publicPreview, refreshPreview, unlockPreview, renderPreviewAsset } =
  await import('../src/server/svg-previews');
const { svgVisitor } = await import('../src/lib/svg-visitor');
const { saveConfigs } = await import('../src/modules/config/service');
after(async () => {
  await dispose?.();
  await rm(directory, { recursive: true, force: true });
});
let index = 0;
function input(extra: Record<string, unknown> = {}) {
  const id = String(++index);
  return {
    visitorHash: 'visitor-' + id,
    clientHash: 'client-' + id,
    ipHash: 'ip-' + id,
    inputHash: 'input-' + id,
    mode: 'image' as const,
    options: '{}',
    ...extra,
  } as Parameters<typeof claimPreview>[0];
}
async function account(paid = false, balance = 1000) {
  const id = 'preview-user-' + ++index;
  await db()
    .insert(user)
    .values({ id, name: 'Preview test', email: id + '@example.test' });
  if (balance) await grant({ userId: id, credits: balance });
  const orderId = 'order-' + id;
  if (paid)
    await db().insert(order).values({
      id: orderId,
      orderNo: orderId,
      userId: id,
      status: 'paid',
      amount: 700,
      currency: 'usd',
      productId: 'starter_monthly',
      paymentProvider: 'test',
      checkoutInfo: '{}',
    });
  return { id, orderId };
}
const source =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path d="M8 8H56V56H8Z" fill="#3159ef"/></svg>';
async function ready(params: ReturnType<typeof input>, credits = 160) {
  const row = await claimPreview(params);
  return completePreview(row, {
    svg: source,
    previewPng: await rasterizeSvg(source),
    credits,
    stats: JSON.stringify({
      width: 64,
      height: 64,
      paths: 1,
      bytes: source.length,
      colors: ['#3159ef'],
    }),
  });
}

test('concurrent identical claims consume exactly one visitor/client/IP allowance', async () => {
  const params = input();
  const rows = await Promise.all([
    claimPreview(params),
    claimPreview(params),
    claimPreview(params),
  ]);
  assert.equal(new Set(rows.map((row) => row.id)).size, 1);
  const [quota] = await db()
    .select()
    .from(svgPreviewQuota)
    .where(eq(svgPreviewQuota.id, 'client:' + params.clientHash));
  assert.equal(quota.count, 1);
  assert.equal(await clientPreviewUsed(params.clientHash), true);
});
test('text and image share one successful preview; changing the cookie does not reset the client claim', async () => {
  const params = input();
  await ready(params);
  await assert.rejects(
    claimPreview({ ...params, inputHash: 'a-new-input', mode: 'text' }),
    (e) => e instanceof PreviewError && e.code === 'trial_used'
  );
  await assert.rejects(
    claimPreview({
      ...params,
      visitorHash: 'a-new-cookie',
      inputHash: 'new-cookie-input',
    }),
    (e) => e instanceof PreviewError && e.code === 'trial_used'
  );
});
test('failed previews can retry the same visitor, but each new upstream attempt is bounded', async () => {
  const params = input();
  let row = await claimPreview(params);
  row = await completePreview(row, null);
  row = await claimPreview({ ...params, inputHash: 'retry' });
  assert.equal(row.attempt, 2);
  row = await completePreview(row, null);
  row = await claimPreview({ ...params, inputHash: 'retry-again' });
  assert.equal(row.attempt, 3);
  await completePreview(row, null);
  await assert.rejects(
    claimPreview({ ...params, inputHash: 'too-many' }),
    (e) => e instanceof PreviewError && e.code === 'trial_limit'
  );
});
test('persistent per-IP quota limits independent visitor cookies and client identifiers', async () => {
  const ip = 'shared-' + ++index;
  for (let i = 0; i < 3; i++) await claimPreview(input({ ipHash: ip }));
  await assert.rejects(
    claimPreview(input({ ipHash: ip })),
    (e) => e instanceof PreviewError && e.code === 'trial_limit'
  );
});
test('account binding is durable and refuses cross-account reads or second free claims', async () => {
  const params = input();
  const row = await ready(params);
  const a = await account(),
    b = await account();
  const bound = await bindPreview(row, params.visitorHash, a.id);
  assert.equal(bound.userId, a.id);
  assert.equal((await visitorPreview('new-browser', a.id))?.id, row.id);
  assert.equal(await visitorPreview(params.visitorHash, b.id), undefined);
  await assert.rejects(bindPreview(bound, params.visitorHash, b.id));
  await assert.rejects(
    claimPreview(input({ userId: a.id })),
    (e) => e instanceof PreviewError && e.code === 'trial_used'
  );
});
test('credits alone do not grant a paid entitlement; a refunded purchase revokes it', async () => {
  const a = await account();
  assert.equal(await paidSvgOrder(a.id), undefined);
  const p = await account(true);
  assert.equal(await paidSvgOrder(p.id), p.orderId);
  await db()
    .update(order)
    .set({ status: 'refunded' })
    .where(eq(order.id, p.orderId));
  assert.equal(await paidSvgOrder(p.id), undefined);
});
test('unlock requires an existing paid SVG order and cannot manufacture a payment with credits', async () => {
  const a = await account();
  await assert.rejects(
    fulfillSvg({
      id: 'missing-order-svg',
      userId: a.id,
      paidOrderId: 'nonexistent',
      model: 'test',
      provider: 'svgai-preview',
      options: '{}',
      svg: source,
      credits: 160,
    }),
    (e) => e instanceof TaskBillingError && e.code === 'payment_required'
  );
  assert.equal(await getBalance(a.id), 1000);
  assert.equal(await findTask('missing-order-svg'), undefined);
});
test('concurrent preview exports debit once; repeat downloads never debit again', async () => {
  const a = await account(true);
  const params = input();
  const row = await ready(params);
  const viewer = {
    ...params,
    userId: a.id,
    paidOrderId: a.orderId,
    preview: row,
    setCookie: undefined,
    clientUsed: true,
  };
  const results = await Promise.all([
    unlockPreview(viewer, row),
    unlockPreview(viewer, row),
    unlockPreview(viewer, row),
  ]);
  assert.equal(new Set(results.map((r) => r.id)).size, 1);
  assert.equal(await getBalance(a.id), 840);
  await unlockPreview(
    viewer,
    (await visitorPreview(params.visitorHash, a.id))!
  );
  assert.equal(await getBalance(a.id), 840);
});
test('insufficient credits leave the preview locked and do not partially create a paid result', async () => {
  const a = await account(true, 10);
  const params = input();
  const row = await ready(params);
  await assert.rejects(
    unlockPreview(
      {
        ...params,
        userId: a.id,
        paidOrderId: a.orderId,
        preview: row,
        setCookie: undefined,
        clientUsed: true,
      },
      row
    ),
    (e) => e instanceof TaskBillingError && e.code === 'insufficient_credits'
  );
  assert.equal(await getBalance(a.id), 10);
  assert.equal(await findTask('preview_unlock_' + row.id), undefined);
});
test('public preview metadata never includes vectors, source options, PNG bytes or visitor identifiers', async () => {
  const row = await ready(input());
  const result = publicPreview(row);
  assert.equal(result.status, 'succeeded');
  assert.match(result.previewUrl!, /^\/api\/svg\/preview\?asset=/);
  for (const key of ['svg', 'options', 'previewPng', 'visitorHash', 'userId'])
    assert.equal(key in result, false);
  assert.doesNotMatch(JSON.stringify(result), /<svg|<path/);
});

test('color and outline previews render together as PNG without unlocking the SVG', async () => {
  const row = await ready(input());
  const images = await Promise.all([
    renderPreviewAsset(row, row.id),
    renderPreviewAsset(row, row.id, true),
  ]);
  for (const image of images) {
    const png = Buffer.from(image);
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    assert.equal(png.readUInt32BE(16), 512);
    assert.equal(png.readUInt32BE(20), 512);
    assert.doesNotMatch(png.toString(), /<svg|<path/);
  }
  assert.notDeepEqual(images[0], images[1]);
  assert.equal((await findPreview(row.id))?.unlockedTaskId, null);
  assert.equal('svg' in publicPreview(row), false);
});

test('both preview image variants reject a foreign asset or a missing viewer preview', async () => {
  const row = await ready(input());
  const attempts = await Promise.allSettled([
    renderPreviewAsset(row, 'another-preview'),
    renderPreviewAsset(row, 'another-preview', true),
    renderPreviewAsset(undefined, row.id, true),
    renderPreviewAsset({ ...row, status: 'pending' }, row.id, true),
  ]);
  assert.ok(
    attempts.every(
      (result) =>
        result.status === 'rejected' &&
        result.reason instanceof PreviewError &&
        result.reason.code === 'not_found'
    )
  );
});
test('normalized raster tracing and PNG preview rendering stay on the server', async () => {
  const pixels = new Uint8Array(64 * 64 * 4).fill(255);
  for (let y = 16; y < 48; y++)
    for (let x = 16; x < 48; x++) {
      const n = (y * 64 + x) * 4;
      pixels[n] = 230;
      pixels[n + 1] = 80;
      pixels[n + 2] = 40;
    }
  const bytes = encode({
    width: 64,
    height: 64,
    data: pixels,
    channels: 4,
    depth: 8,
  });
  const params = parseImageInput({
    image: Buffer.from(bytes).toString('base64'),
    colors: 4,
    removeBackground: true,
  });
  const svg = await traceImage(params);
  assert.match(svg, /<path/);
  assert.doesNotMatch(svg, /<image/);
  const png = Buffer.from(await rasterizeSvg(svg), 'base64');
  assert.equal(png.subarray(1, 4).toString(), 'PNG');
  const bomb = bytes.slice();
  new DataView(bomb.buffer).setUint32(16, 1);
  new DataView(bomb.buffer).setUint32(20, 1);
  assert.throws(
    () =>
      parseImageInput({
        image: Buffer.from(bomb).toString('base64'),
        colors: 4,
        removeBackground: false,
      }),
    /dimensions/
  );
});
test('visitor cookies are signed, HttpOnly, and cannot be forged into another preview identity', async () => {
  const first = await svgVisitor(
    new Request('https://product.example/', {
      headers: { 'user-agent': 'test', 'cf-connecting-ip': '203.0.113.4' },
    })
  );
  assert.match(first.setCookie!, /HttpOnly/);
  assert.match(first.setCookie!, /Secure/);
  const cookie = first.setCookie!.split(';')[0];
  const next = await svgVisitor(
    new Request('https://product.example/', {
      headers: {
        cookie,
        'user-agent': 'test',
        'cf-connecting-ip': '203.0.113.4',
      },
    })
  );
  assert.equal(next.visitorHash, first.visitorHash);
  assert.equal(next.setCookie, undefined);
  const forged = await svgVisitor(
    new Request('https://product.example/', {
      headers: {
        cookie: cookie.slice(0, -1) + (cookie.endsWith('0') ? '1' : '0'),
      },
    })
  );
  assert.notEqual(forged.visitorHash, first.visitorHash);
  assert.ok(forged.setCookie);
});
test('anonymous text generation uses one stable upstream idempotency key and only exposes a raster preview', async () => {
  await saveConfigs({
    seeapi_api_key: 'test-preview-key',
    seeapi_base_url: 'https://api.seeapi.com',
  });
  const params = input({
    mode: 'text',
    options: JSON.stringify({
      prompt: 'A simple blue shape',
      style: 'icon',
      aspect: '1:1',
    }),
  });
  let row = await claimPreview(params);
  const native = globalThis.fetch;
  const keys: string[] = [];
  globalThis.fetch = (async (url, init) => {
    if (String(url).startsWith('https://assets.seeapi.com/'))
      return new Response(source);
    if (init?.method === 'POST') {
      keys.push(new Headers(init.headers).get('Idempotency-Key')!);
      return Response.json({
        generation: {
          id: 'preview-provider-task',
          status: 'processing',
          consumed_credits: 0,
        },
      });
    }
    return Response.json({
      generation: {
        id: 'preview-provider-task',
        status: 'succeeded',
        consumed_credits: 20,
        result: {
          assets: [
            {
              url: 'https://assets.seeapi.com/preview.svg',
              mime_type: 'image/svg+xml',
            },
          ],
        },
      },
    });
  }) as typeof fetch;
  try {
    row = await refreshPreview(row);
    assert.equal(row.status, 'processing');
    row = await refreshPreview(row);
    assert.equal(row.status, 'succeeded');
    assert.equal(row.costCredits, 160);
    assert.equal(keys.length, 1);
    assert.match(keys[0], new RegExp(row.id));
    assert.equal('svg' in publicPreview(row), false);
  } finally {
    globalThis.fetch = native;
  }
});
