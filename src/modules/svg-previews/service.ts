import { and, eq, inArray, isNull, or, sql } from 'drizzle-orm';

import { db } from '@/core/db';
import { atomic, AtomicGuardError, guard } from '@/core/db/atomic';
import { envConfigs } from '@/config';
import { order, svgPreview, svgPreviewQuota } from '@/config/db/schema';
import { pricingCatalog } from '@/config/pricing';
import { getUuid } from '@/lib/hash';

export class PreviewError extends Error {
  constructor(
    public code:
      | 'trial_used'
      | 'trial_limit'
      | 'not_found'
      | 'payment_required'
      | 'invalid_input'
  ) {
    super(code);
  }
}
export type Preview = typeof svgPreview.$inferSelect;
export async function paidSvgOrder(
  userId?: string
): Promise<string | undefined> {
  if (!userId) return undefined;
  const products = Object.values(pricingCatalog)
    .filter((p) => p.kind !== 'guest_post')
    .map((p) => p.productId);
  const [found] = await db()
    .select({ id: order.id })
    .from(order)
    .where(
      and(
        eq(order.userId, userId),
        eq(order.status, 'paid'),
        sql`${order.amount}>0`,
        isNull(order.deletedAt),
        inArray(order.productId, products)
      )
    )
    .limit(1);
  return found?.id;
}
export const paidSvgAccess = async (userId?: string) =>
  Boolean(await paidSvgOrder(userId));
export async function clientPreviewUsed(clientHash: string): Promise<boolean> {
  const [row] = await db()
    .select({ count: svgPreviewQuota.count })
    .from(svgPreviewQuota)
    .where(eq(svgPreviewQuota.id, `client:${clientHash}`))
    .limit(1);
  return Boolean(row?.count);
}
export async function findPreview(id: string): Promise<Preview | undefined> {
  const [row] = await db()
    .select()
    .from(svgPreview)
    .where(eq(svgPreview.id, id))
    .limit(1);
  return row;
}
export async function visitorPreview(
  visitorHash: string,
  userId?: string
): Promise<Preview | undefined> {
  if (userId) {
    const [owned] = await db()
      .select()
      .from(svgPreview)
      .where(eq(svgPreview.userId, userId))
      .limit(1);
    if (owned) return owned;
  }
  const [row] = await db()
    .select()
    .from(svgPreview)
    .where(eq(svgPreview.visitorHash, visitorHash))
    .limit(1);
  return row && (!row.userId || row.userId === userId) ? row : undefined;
}
export async function bindPreview(
  row: Preview,
  visitorHash: string,
  userId: string
): Promise<Preview> {
  if (row.userId) {
    if (row.userId !== userId) throw new PreviewError('not_found');
    return row;
  }
  if (row.visitorHash !== visitorHash) throw new PreviewError('not_found');
  try {
    await atomic((q) => [
      guard({
        table: svgPreview,
        column: 'visitorHash',
        where: eq(svgPreview.id, row.id),
        require: or(isNull(svgPreview.userId), eq(svgPreview.userId, userId))!,
        message: 'Preview belongs to another account',
      }),
      q
        .update(svgPreview)
        .set({ userId, updatedAt: new Date() })
        .where(eq(svgPreview.id, row.id)),
    ]);
  } catch {
    throw new PreviewError('trial_used');
  }
  return (await findPreview(row.id))!;
}
export async function claimPreview(params: {
  visitorHash: string;
  userId?: string;
  ipHash: string;
  clientHash: string;
  inputHash: string;
  mode: 'text' | 'image';
  options: string;
}): Promise<Preview> {
  let existing = await visitorPreview(params.visitorHash, params.userId);
  if (existing) {
    if (existing.userId && existing.userId !== params.userId)
      throw new PreviewError('trial_used');
    if (existing.status !== 'failed') {
      if (existing.inputHash !== params.inputHash)
        throw new PreviewError('trial_used');
      return existing;
    }
    if (existing.attempt >= 3) throw new PreviewError('trial_limit');
  }
  const day = new Date().toISOString().slice(0, 10);
  const limits = [
    ...(!existing ? [{ id: `client:${params.clientHash}`, limit: 1 }] : []),
    { id: `ip:${day}:${params.ipHash}`, limit: 3 },
    {
      id: `global:${day}`,
      limit: Math.max(
        1,
        Number(envConfigs.svg_free_preview_daily_limit) || 100
      ),
    },
  ];
  const id = existing?.id || getUuid();
  try {
    await atomic((q) => [
      ...limits.flatMap((item) => [
        q
          .insert(svgPreviewQuota)
          .values({ id: item.id, count: 0 })
          .onConflictDoNothing(),
        guard({
          table: svgPreviewQuota,
          column: 'id',
          where: eq(svgPreviewQuota.id, item.id),
          require: sql`${svgPreviewQuota.count}<${item.limit}`,
          message: item.id.startsWith('client:')
            ? 'Preview already used'
            : 'Preview daily limit reached',
        }),
        q
          .update(svgPreviewQuota)
          .set({ count: sql`${svgPreviewQuota.count}+1` })
          .where(eq(svgPreviewQuota.id, item.id)),
      ]),
      existing &&
        guard({
          table: svgPreview,
          column: 'visitorHash',
          where: eq(svgPreview.id, id),
          require: and(
            eq(svgPreview.status, 'failed'),
            eq(svgPreview.attempt, existing.attempt)
          )!,
          message: 'Preview already claimed',
        }),
      existing
        ? q
            .update(svgPreview)
            .set({
              inputHash: params.inputHash,
              mode: params.mode,
              options: params.options,
              status: 'pending',
              providerTaskId: null,
              attempt: sql`${svgPreview.attempt}+1`,
              updatedAt: new Date(),
            })
            .where(eq(svgPreview.id, id))
        : q.insert(svgPreview).values({
            id,
            visitorHash: params.visitorHash,
            userId: params.userId || null,
            inputHash: params.inputHash,
            mode: params.mode,
            options: params.options,
            status: 'pending',
            attempt: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
    ]);
  } catch (error) {
    const replay = await visitorPreview(params.visitorHash, params.userId);
    if (
      replay &&
      replay.inputHash === params.inputHash &&
      replay.status !== 'failed'
    )
      return replay;
    if (replay) throw new PreviewError('trial_used');
    if (error instanceof AtomicGuardError)
      throw new PreviewError(
        (await clientPreviewUsed(params.clientHash))
          ? 'trial_used'
          : 'trial_limit'
      );
    if (error instanceof Error && /unique|constraint/i.test(error.message))
      throw new PreviewError('trial_used');
    throw error;
  }
  return (await findPreview(id))!;
}
export async function attachPreview(row: Preview, providerTaskId: string) {
  await db()
    .update(svgPreview)
    .set({ providerTaskId, status: 'processing', updatedAt: new Date() })
    .where(
      and(
        eq(svgPreview.id, row.id),
        eq(svgPreview.attempt, row.attempt),
        inArray(svgPreview.status, ['pending', 'processing'])
      )
    );
  return (await findPreview(row.id))!;
}
export async function completePreview(
  row: Preview,
  result: {
    svg: string;
    previewPng: string;
    stats: string;
    credits: number;
  } | null
) {
  await db()
    .update(svgPreview)
    .set({
      status: result ? 'succeeded' : 'failed',
      svg: result?.svg || null,
      previewPng: result?.previewPng || null,
      stats: result?.stats || null,
      costCredits: result?.credits || 0,
      options: result ? '{}' : row.options,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(svgPreview.id, row.id),
        eq(svgPreview.attempt, row.attempt),
        inArray(svgPreview.status, ['pending', 'processing'])
      )
    );
  return (await findPreview(row.id))!;
}
