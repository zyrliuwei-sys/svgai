import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { and, eq } from 'drizzle-orm';

import { generationCredits } from '../src/config/generation';
import { pricingCatalog } from '../src/config/pricing';

const directory = await mkdtemp(join(tmpdir(), 'svgai-billing-'));
Object.assign(process.env, {
  DATABASE_PROVIDER: 'sqlite',
  DATABASE_URL: `file:${directory}/test.db`,
  AUTH_SECRET: 'isolated-test-secret-for-svg-billing',
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
let disposeD1: (() => Promise<void>) | undefined;
if (process.env.ATOMIC_D1 === '1') {
  const { createClient } = await import('@libsql/client');
  const sqlite = createClient({ url: process.env.DATABASE_URL! });
  const ddl = (
    await sqlite.execute(
      "select sql from sqlite_master where sql is not null and name not like 'sqlite_%' and name not like '__drizzle%' order by type='index'"
    )
  ).rows.map((row) => String(row.sql));
  sqlite.close();
  const { getPlatformProxy } = await import('wrangler');
  const proxy = await getPlatformProxy<{ DB: any }>({
    configPath: 'wrangler.jsonc',
    remoteBindings: false,
    persist: { path: join(directory, 'd1') },
  });
  for (const statement of ddl) await proxy.env.DB.prepare(statement).run();
  (globalThis as any).__CF_ENV__ = proxy.env;
  process.env.DATABASE_PROVIDER = 'd1';
  disposeD1 = proxy.dispose;
}
const { db } = await import('../src/core/db');
const { aiTask, credit, user } = await import('../src/config/db/schema');
const { getBalance, grant } = await import('../src/modules/credits/service');
const { reserveGeneration, settleGeneration, findTask } =
  await import('../src/modules/ai-tasks/service');
const { setAtomicModeForTests } = await import('../src/core/db/atomic');
setAtomicModeForTests('batch');
after(async () => {
  await disposeD1?.();
  await rm(directory, { recursive: true, force: true });
});
let count = 0;
async function fixture(balance = 1000) {
  const userId = `svg-billing-${++count}`;
  await db()
    .insert(user)
    .values({
      id: userId,
      email: `${userId}@example.test`,
      name: 'Billing test',
    });
  if (balance) await grant({ userId, credits: balance });
  const params = {
    id: `task-${userId}`,
    userId,
    model: 'gpt-image-2-6-sunburst',
    prompt: 'A flower',
    options: '{"style":"icon"}',
    credits: 160,
  };
  return { userId, params };
}
const settle = (taskId: string, credits: number, failed = false) =>
  settleGeneration({
    taskId,
    credits,
    failed,
    result: { providerCredits: credits / 8, svg: '<svg/>' },
  });

test('actual provider usage is multiplied by eight and rounded once, without float overcharges', () => {
  assert.equal(generationCredits(10.816), 87);
  assert.equal(generationCredits(20), 160);
  assert.equal(generationCredits(1.125), 9);
  assert.equal(generationCredits(1.001), 9);
  for (const value of [-1, NaN, Infinity, 0.0001])
    assert.throws(() => generationCredits(value));
});
test('catalog contains three credit packs and three discounted monthly plans with the documented value floors', () => {
  const products = Object.values(pricingCatalog).filter(
    (p) => p.kind !== 'guest_post'
  );
  assert.equal(products.length, 6);
  assert.equal(products.filter((p) => !p.plan).length, 3);
  assert.equal(products.filter((p) => p.plan?.interval === 'month').length, 3);
  for (const interval of ['once', 'monthly']) {
    const pricesPerCredit = ['starter', 'pro', 'studio'].map((tier) => {
      const product = pricingCatalog[`${tier}_${interval}`];
      return product.priceInCents / product.credits;
    });
    assert.ok(pricesPerCredit[0]! > pricesPerCredit[1]!);
    assert.ok(pricesPerCredit[1]! > pricesPerCredit[2]!);
  }
  for (const product of products) {
    const providerCreditCost = 299 / 55000;
    const minimumAppCreditPrice =
      providerCreditCost * (product.plan ? 6 / 8 : 1);
    assert.ok(
      product.priceInCents / 100 / product.credits >= minimumAppCreditPrice
    );
    assert.equal(Boolean(product.creditsValidDays), Boolean(product.plan));
    if (product.plan) {
      const creditPack =
        pricingCatalog[product.productId.replace('_monthly', '_once')];
      assert.equal(product.credits, creditPack.credits);
      assert.ok(product.priceInCents < creditPack.priceInCents);
    }
  }
});
test('reservation retries and concurrent identical requests debit only once', async () => {
  const { userId, params } = await fixture();
  await Promise.all([
    reserveGeneration(params),
    reserveGeneration(params),
    reserveGeneration(params),
  ]);
  assert.equal(await getBalance(userId), 840);
  assert.equal(
    (
      await db()
        .select()
        .from(credit)
        .where(eq(credit.transactionNo, `svg_reserve_${params.id}`))
    ).length,
    1
  );
  await assert.rejects(
    reserveGeneration({ ...params, prompt: 'Different input' })
  );
  assert.equal(await getBalance(userId), 840);
});
test('concurrent distinct reservations cannot spend the same remaining credits', async () => {
  const { userId, params } = await fixture(160);
  const results = await Promise.allSettled([
    reserveGeneration(params),
    reserveGeneration({ ...params, id: params.id + '-other' }),
  ]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(await getBalance(userId), 0);
});
test('settlement returns the unused reservation once even with simultaneous polling', async () => {
  const { userId, params } = await fixture();
  await reserveGeneration(params);
  await Promise.all([
    settle(params.id, 87),
    settle(params.id, 87),
    settle(params.id, 87),
  ]);
  assert.equal(await getBalance(userId), 913);
  assert.equal((await findTask(params.id)).costCredits, 87);
  const [usage] = await db()
    .select()
    .from(credit)
    .where(eq(credit.transactionNo, `svg_reserve_${params.id}`));
  assert.equal(usage.description, 'SVG generation usage');
  await settle(params.id, 87);
  assert.equal(await getBalance(userId), 913);
});
test('failure restores the complete reservation and concurrent failures do not over-refund', async () => {
  const { userId, params } = await fixture();
  await reserveGeneration(params);
  await Promise.all([settle(params.id, 0, true), settle(params.id, 0, true)]);
  assert.equal(await getBalance(userId), 1000);
  const [released] = await db()
    .select()
    .from(credit)
    .where(eq(credit.transactionNo, `svg_reserve_${params.id}`));
  assert.equal(
    released.description,
    'SVG generation failed (credits returned)'
  );
  assert.equal((await findTask(params.id)).status, 'failed');
  await settle(params.id, 0, true);
  assert.equal(await getBalance(userId), 1000);
});
test('usage above the reservation charges the difference once', async () => {
  const { userId, params } = await fixture();
  await reserveGeneration(params);
  await Promise.all([settle(params.id, 240), settle(params.id, 240)]);
  assert.equal(await getBalance(userId), 760);
  assert.equal((await findTask(params.id)).costCredits, 240);
  const [ledger] = await db()
    .select()
    .from(credit)
    .where(eq(credit.transactionNo, `svg_extra_${params.id}`));
  assert.equal(ledger.credits, -80);
});
test('insufficient final balance preserves pending result; top-up then settles once', async () => {
  const { userId, params } = await fixture(160);
  await reserveGeneration(params);
  await assert.rejects(settle(params.id, 240));
  assert.equal(await getBalance(userId), 0);
  assert.equal((await findTask(params.id)).status, 'pending');
  await grant({ userId, credits: 100 });
  await settle(params.id, 240);
  assert.equal(await getBalance(userId), 20);
});
test('settlement ledger prevents a status reset from causing a second debit', async () => {
  const { userId, params } = await fixture();
  await reserveGeneration(params);
  await settle(params.id, 160);
  await db()
    .update(aiTask)
    .set({ status: 'processing' })
    .where(eq(aiTask.id, params.id));
  await assert.rejects(settle(params.id, 240));
  assert.equal(await getBalance(userId), 840);
});
test('refunded reservation restores original grant expiration rather than creating permanent credit', async () => {
  const { userId, params } = await fixture(0);
  const source = await grant({
    userId,
    credits: 200,
    expiresAt: new Date(Date.now() + 60_000),
  });
  await reserveGeneration(params);
  await settle(params.id, 0, true);
  const [record] = await db()
    .select()
    .from(credit)
    .where(and(eq(credit.id, source.id), eq(credit.transactionType, 'grant')));
  assert.equal(record.remainingCredits, 200);
  assert.equal(record.expiresAt?.getTime(), source.expiresAt?.getTime());
});

const { startSvgGeneration, refreshSvgGeneration, ownedSvgTask } =
  await import('../src/server/svg-generation');
const { seeApiCredentials, createSeeApiGeneration } =
  await import('../src/core/ai/seeapi-generation');
const realFetch = globalThis.fetch;
const credentials = {
  baseUrl: 'https://api.seeapi.com',
  apiKey: 'test-only-secret',
};
const requestInput = {
  prompt: 'A simple flower',
  style: 'icon',
  aspect: '1:1',
} as const;
const validSvg =
  '<svg viewBox="0 0 100 100"><title>A flower</title><path fill="#f00" d="M0 0L50 0L20 30Z"/></svg>';

test('complete asynchronous SeeAPI pipeline reserves, polls, sanitizes the native SVG and settles actual cost', async () => {
  const { userId } = await fixture();
  const requests: { url: string; init?: RequestInit }[] = [];
  const runtime = globalThis as typeof globalThis & {
    __CF_ENV__?: Record<string, unknown>;
  };
  const previousEnv = runtime.__CF_ENV__;
  const archived = new Map<string, string>();
  let storageAvailable = false;
  runtime.__CF_ENV__ = {
    ...previousEnv,
    SVG_ARCHIVE: {
      async put(key: string, svg: string) {
        if (!storageAvailable) throw new Error('Test outage');
        archived.set(key, svg);
      },
    },
  };
  globalThis.fetch = (async (url, init) => {
    requests.push({ url: String(url), init });
    if (String(url).startsWith('https://assets.seeapi.com/')) {
      assert.equal(new Headers(init?.headers).has('Authorization'), false);
      return new Response(validSvg);
    }
    return Response.json({
      generation:
        init?.method === 'POST'
          ? { id: 'task_test_live', status: 'processing', consumed_credits: 0 }
          : {
              id: 'task_test_live',
              status: 'succeeded',
              consumed_credits: 10.816,
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
  }) as typeof fetch;
  try {
    const first = await startSvgGeneration({
      userId,
      requestId: crypto.randomUUID(),
      input: requestInput,
      credentials,
    });
    assert.equal(first.status, 'processing');
    assert.equal(await getBalance(userId), 840);
    const task = await ownedSvgTask(first.taskId, userId);
    assert.ok(task);
    assert.equal(await ownedSvgTask(first.taskId, 'another-user'), undefined);
    await assert.rejects(
      refreshSvgGeneration(task, credentials),
      /SVG storage is temporarily unavailable/
    );
    const completed = await ownedSvgTask(first.taskId, userId);
    assert.equal(completed?.status, 'success');
    assert.equal(await getBalance(userId), 913);
    storageAvailable = true;
    const [result, replay] = await Promise.all([
      refreshSvgGeneration(completed!, credentials),
      refreshSvgGeneration(completed!, credentials),
    ]);
    assert.equal(result.status, 'succeeded');
    assert.deepEqual(replay, result);
    assert.equal(result.credits, 87);
    assert.equal(await getBalance(userId), 913);
    assert.match(result.svg!, /<path/);
    assert.doesNotMatch(result.svg!, /<title/);
    assert.equal(archived.get(`tasks/${first.taskId}.svg`), result.svg);
    const body = JSON.parse(String(requests[0].init?.body));
    assert.equal(body.model, 'gpt-image-2-6-sunburst');
    assert.equal(body.provider, 'seeapi');
    assert.equal(body.input.output_format, 'svg');
    assert.equal(
      new Headers(requests[0].init?.headers).get('Idempotency-Key'),
      first.taskId
    );
    await refreshSvgGeneration((await findTask(first.taskId))!, credentials);
    assert.equal(requests.length, 3);
  } finally {
    runtime.__CF_ENV__ = previousEnv;
    globalThis.fetch = realFetch;
  }
});
test('an ambiguous submit timeout retains the reservation and retries with the identical upstream key', async () => {
  const { userId } = await fixture();
  const keys: string[] = [];
  const requestId = crypto.randomUUID();
  globalThis.fetch = (async (_url, init) => {
    keys.push(new Headers(init?.headers).get('Idempotency-Key')!);
    throw new Error('network timeout with private diagnostics');
  }) as typeof fetch;
  try {
    await assert.rejects(
      startSvgGeneration({
        userId,
        requestId,
        input: requestInput,
        credentials,
      })
    );
    assert.equal(await getBalance(userId), 840);
    globalThis.fetch = (async (_url, init) => {
      keys.push(new Headers(init?.headers).get('Idempotency-Key')!);
      return Response.json({
        generation: {
          id: 'task_recovered',
          status: 'processing',
          consumed_credits: 0,
        },
      });
    }) as typeof fetch;
    const result = await startSvgGeneration({
      userId,
      requestId,
      input: requestInput,
      credentials,
    });
    assert.equal(result.status, 'processing');
    assert.equal(await getBalance(userId), 840);
    assert.equal(keys[0], keys[1]);
  } finally {
    globalThis.fetch = realFetch;
  }
});
test('definitive provider rejection refunds once; replay does not submit or charge again', async () => {
  const { userId } = await fixture();
  const requestId = crypto.randomUUID();
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    return Response.json(
      { error: 'private upstream message' },
      { status: 402 }
    );
  }) as typeof fetch;
  try {
    for (let i = 0; i < 2; i++)
      assert.equal(
        (
          await startSvgGeneration({
            userId,
            requestId,
            input: requestInput,
            credentials,
          })
        ).status,
        'failed'
      );
    assert.equal(calls, 1);
    assert.equal(await getBalance(userId), 1000);
  } finally {
    globalThis.fetch = realFetch;
  }
});
test('credentials only go to the official API origin', async () => {
  let called = false;
  globalThis.fetch = (async () => {
    called = true;
    return Response.json({});
  }) as typeof fetch;
  try {
    assert.throws(() =>
      seeApiCredentials({
        seeapi_api_key: 'test-key',
        seeapi_base_url: 'https://untrusted.example',
      })
    );
    await assert.rejects(
      createSeeApiGeneration(
        { ...credentials, baseUrl: 'https://untrusted.example' },
        { idempotencyKey: 'test', prompt: 'Flower', aspect: '1:1' }
      )
    );
    assert.equal(called, false);
  } finally {
    globalThis.fetch = realFetch;
  }
});
