import { and, desc, eq, isNull, sql } from 'drizzle-orm';

import { db } from '@/core/db';
import { atomic, AtomicGuardError, guard } from '@/core/db/atomic';
import { aiTask, credit, order, user } from '@/config/db/schema';
import { pricingCatalog } from '@/config/pricing';
import {
  planConsume,
  planReleaseReservation,
  revoke,
} from '@/modules/credits/service';
import { getUuid } from '@/lib/hash';

export enum AITaskStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SUCCESS = 'success',
  FAILED = 'failed',
  CANCELED = 'canceled',
}

/**
 * Create an AI task with optional credit consumption.
 */
export async function createTask(params: {
  userId: string;
  mediaType: string;
  provider: string;
  model: string;
  prompt: string;
  costCredits?: number;
  options?: any;
}): Promise<any> {
  const { userId, mediaType, provider, model, prompt, costCredits, options } =
    params;

  for (let attempt = 0; attempt < 3; attempt++) {
    const taskData: typeof aiTask.$inferInsert = {
      id: getUuid(),
      userId,
      mediaType,
      provider,
      model,
      prompt,
      status: AITaskStatus.PENDING,
      costCredits: costCredits || 0,
    };

    // Plan the credit charge first, then write the task and the charge in one
    // atomic step (D1-safe) — never a task without its charge or vice versa.
    const plan =
      costCredits && costCredits > 0
        ? await planConsume({
            userId,
            credits: costCredits,
            scene: 'ai_task',
            description: `AI ${mediaType} generation`,
            metadata: JSON.stringify({ taskId: taskData.id }),
          })
        : undefined;
    if (plan === null) throw new Error('Insufficient credits');
    if (plan) {
      // Stored for revocation if the task fails.
      taskData.taskInfo = JSON.stringify({
        creditId: plan.consumedCredit.id,
      });
    }

    try {
      await atomic((q) => [
        q.insert(aiTask).values(taskData),
        ...(plan ? plan.steps(q) : []),
      ]);
    } catch (error) {
      // A concurrent spend drained the grants we planned on: re-plan.
      if (error instanceof AtomicGuardError) continue;
      throw error;
    }

    const [task] = await db()
      .select()
      .from(aiTask)
      .where(eq(aiTask.id, taskData.id))
      .limit(1);
    return task;
  }
  throw new Error('Insufficient credits');
}

/**
 * Update task status. Revokes credits on failure.
 */
export async function updateTask(params: {
  taskId: string;
  status: AITaskStatus;
  taskResult?: any;
}) {
  const { taskId, status, taskResult } = params;

  const [task] = await db()
    .select()
    .from(aiTask)
    .where(eq(aiTask.id, taskId))
    .limit(1);

  if (!task) throw new Error('Task not found');

  // Update task
  const updateData: any = { status };
  if (taskResult) {
    updateData.taskResult = JSON.stringify(taskResult);
  }

  await db().update(aiTask).set(updateData).where(eq(aiTask.id, taskId));

  // Revoke credits on failure
  if (status === AITaskStatus.FAILED && task.taskInfo) {
    try {
      const info = JSON.parse(task.taskInfo as string);
      if (info.creditId) {
        await revoke(info.creditId);
      }
    } catch {
      // Ignore parse errors
    }
  }
}

/**
 * Get tasks for a user.
 */
export async function getTasks(params: {
  userId: string;
  mediaType?: string;
  status?: string;
  page?: number;
  limit?: number;
}) {
  const { userId, mediaType, status, page = 1, limit = 20 } = params;

  return db()
    .select()
    .from(aiTask)
    .where(
      and(
        eq(aiTask.userId, userId),
        mediaType ? eq(aiTask.mediaType, mediaType) : undefined,
        status ? eq(aiTask.status, status) : undefined,
        isNull(aiTask.deletedAt)
      )
    )
    .orderBy(desc(aiTask.createdAt))
    .limit(limit)
    .offset((page - 1) * limit);
}

/**
 * Find task by ID.
 */
export async function findTask(taskId: string) {
  const [result] = await db()
    .select()
    .from(aiTask)
    .where(eq(aiTask.id, taskId))
    .limit(1);
  return result;
}

export class TaskBillingError extends Error {
  constructor(
    public readonly code:
      'insufficient_credits' | 'request_conflict' | 'payment_required'
  ) {
    super(code);
  }
}

function paidOrderGuard(userId: string, orderId: string) {
  const products = Object.values(pricingCatalog)
    .filter((p) => p.kind !== 'guest_post')
    .map((p) => sql`${p.productId}`);
  return guard({
    table: user,
    column: 'id',
    where: eq(user.id, userId),
    require: sql`exists(select 1 from ${order} where ${order.id}=${orderId} and ${order.userId}=${userId} and ${order.status}='paid' and ${order.amount}>0 and ${order.deletedAt} is null and ${order.productId} in (${sql.join(products, sql`, `)}))`,
    message: 'A paid SVG purchase is required',
  });
}

/** Deterministic task ID + unique consumption transaction makes browser retries safe. */
export async function reserveGeneration(params: {
  id: string;
  userId: string;
  model: string;
  prompt: string;
  options: string;
  credits: number;
  paidOrderId?: string;
}) {
  const existing = await findTask(params.id);
  if (existing) {
    if (
      existing.userId !== params.userId ||
      existing.options !== params.options ||
      existing.prompt !== params.prompt
    )
      throw new TaskBillingError('request_conflict');
    return existing as typeof aiTask.$inferSelect;
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    const plan = await planConsume({
      userId: params.userId,
      credits: params.credits,
      scene: 'ai_task',
      description: 'SVG generation reservation',
      metadata: JSON.stringify({ taskId: params.id }),
    });
    if (!plan) {
      // Another copy of this same request may already own the reservation.
      const replay = await findTask(params.id);
      if (
        replay &&
        replay.userId === params.userId &&
        replay.options === params.options &&
        replay.prompt === params.prompt
      )
        return replay as typeof aiTask.$inferSelect;
      throw new TaskBillingError('insufficient_credits');
    }
    plan.consumedCredit.transactionNo = `svg_reserve_${params.id}`;
    try {
      await atomic((q) => [
        params.paidOrderId && paidOrderGuard(params.userId, params.paidOrderId),
        q.insert(aiTask).values({
          id: params.id,
          userId: params.userId,
          mediaType: 'image',
          provider: 'seeapi',
          model: params.model,
          prompt: params.prompt,
          options: params.options,
          status: AITaskStatus.PENDING,
          costCredits: params.credits,
          creditId: plan.consumedCredit.id,
          scene: 'svg',
        }),
        ...plan.steps(q),
      ]);
      return (await findTask(params.id)) as typeof aiTask.$inferSelect;
    } catch (error) {
      const replay = await findTask(params.id);
      if (replay) {
        if (
          replay.options !== params.options ||
          replay.userId !== params.userId ||
          replay.prompt !== params.prompt
        )
          throw new TaskBillingError('request_conflict');
        return replay as typeof aiTask.$inferSelect;
      }
      if (!(error instanceof AtomicGuardError)) throw error;
    }
  }
  throw new TaskBillingError('insufficient_credits');
}

/** A completed SVG and its credit debit commit together, with a permanent replay key. */
export async function fulfillSvg(params: {
  id: string;
  userId: string;
  paidOrderId: string;
  model: string;
  provider: string;
  options: string;
  svg: string;
  credits: number;
}) {
  const replay = async () => {
    const existing = await findTask(params.id);
    if (!existing) return undefined;
    if (
      existing.userId !== params.userId ||
      existing.options !== params.options ||
      existing.provider !== params.provider ||
      existing.status !== 'success'
    )
      throw new TaskBillingError('request_conflict');
    return existing as typeof aiTask.$inferSelect;
  };
  const existing = await replay();
  if (existing) return existing;
  if (!Number.isSafeInteger(params.credits) || params.credits < 0)
    throw new Error('Invalid SVG cost');
  for (let attempt = 0; attempt < 3; attempt++) {
    const plan =
      params.credits > 0
        ? await planConsume({
            userId: params.userId,
            credits: params.credits,
            scene: 'ai_task',
            description: 'SVG file unlocked',
            metadata: JSON.stringify({ taskId: params.id }),
          })
        : undefined;
    if (plan === null) {
      const found = await replay();
      if (found) return found;
      throw new TaskBillingError('insufficient_credits');
    }
    if (plan) plan.consumedCredit.transactionNo = `svg_fulfill_${params.id}`;
    try {
      await atomic((q) => [
        paidOrderGuard(params.userId, params.paidOrderId),
        q.insert(aiTask).values({
          id: params.id,
          userId: params.userId,
          mediaType: 'image',
          provider: params.provider,
          model: params.model,
          prompt: '',
          options: params.options,
          status: 'success',
          costCredits: params.credits,
          creditId: plan?.consumedCredit.id,
          scene: 'svg',
          taskResult: JSON.stringify({ svg: params.svg }),
        }),
        ...(plan ? plan.steps(q) : []),
      ]);
      return (await findTask(params.id)) as typeof aiTask.$inferSelect;
    } catch (error) {
      const found = await replay();
      if (found) return found;
      if (!(error instanceof AtomicGuardError)) throw error;
      const [paid] = await db()
        .select({ status: order.status })
        .from(order)
        .where(eq(order.id, params.paidOrderId))
        .limit(1);
      if (!paid || paid.status !== 'paid')
        throw new TaskBillingError('payment_required');
    }
  }
  throw new TaskBillingError('insufficient_credits');
}

export async function attachGeneration(taskId: string, providerTaskId: string) {
  await db()
    .update(aiTask)
    .set({ taskId: providerTaskId, status: AITaskStatus.PROCESSING })
    .where(and(eq(aiTask.id, taskId), eq(aiTask.status, AITaskStatus.PENDING)));
  return (await findTask(taskId)) as typeof aiTask.$inferSelect;
}

/** Settlement and any release/additional charge commit together, once, including on D1. */
export async function settleGeneration(params: {
  taskId: string;
  credits: number;
  failed: boolean;
  result: Record<string, unknown>;
}) {
  if (!Number.isSafeInteger(params.credits) || params.credits < 0)
    throw new Error('Invalid generation cost');
  for (let attempt = 0; attempt < 3; attempt++) {
    const task = (await findTask(params.taskId)) as
      typeof aiTask.$inferSelect | undefined;
    if (!task) throw new Error('Task not found');
    if (
      [AITaskStatus.SUCCESS, AITaskStatus.FAILED].includes(
        task.status as AITaskStatus
      )
    )
      return task;
    try {
      const finalCost = params.failed ? 0 : params.credits;
      const extra =
        finalCost > task.costCredits
          ? await planConsume({
              userId: task.userId,
              credits: finalCost - task.costCredits,
              scene: 'ai_task',
              description: 'SVG generation final usage',
              metadata: JSON.stringify({ taskId: task.id }),
            })
          : undefined;
      if (extra === null) throw new TaskBillingError('insufficient_credits');
      if (extra) extra.consumedCredit.transactionNo = `svg_extra_${task.id}`;
      const release =
        finalCost < task.costCredits && task.creditId
          ? await planReleaseReservation(
              task.creditId,
              task.costCredits - finalCost
            )
          : undefined;
      await atomic((q) => [
        guard({
          table: aiTask,
          column: 'userId',
          where: eq(aiTask.id, task.id),
          require: sql`${aiTask.status} in ('pending', 'processing')`,
          message: 'Task already settled',
        }),
        // Permanent unique ledger key also protects against an accidental status reset.
        q.insert(credit).values({
          id: getUuid(),
          userId: task.userId,
          transactionNo: `svg_settle_${task.id}`,
          transactionType: 'consume',
          transactionScene: 'ai_settlement',
          credits: 0,
          remainingCredits: 0,
          status: 'active',
          description: 'SVG usage settled',
          metadata: JSON.stringify({
            taskId: task.id,
            providerCredits: params.result.providerCredits,
            multiplier: 8,
          }),
        }),
        ...(extra ? extra.steps(q) : []),
        ...(release ? release(q) : []),
        task.creditId &&
          q
            .update(credit)
            .set({
              description: params.failed
                ? 'SVG generation failed (credits returned)'
                : 'SVG generation usage',
            })
            .where(
              and(eq(credit.id, task.creditId), eq(credit.userId, task.userId))
            ),
        q
          .update(aiTask)
          .set({
            status: params.failed ? AITaskStatus.FAILED : AITaskStatus.SUCCESS,
            costCredits: finalCost,
            taskResult: JSON.stringify(params.result),
          })
          .where(eq(aiTask.id, task.id)),
      ]);
      return (await findTask(task.id)) as typeof aiTask.$inferSelect;
    } catch (error) {
      const fresh = (await findTask(task.id)) as typeof aiTask.$inferSelect;
      if (
        [AITaskStatus.SUCCESS, AITaskStatus.FAILED].includes(
          fresh.status as AITaskStatus
        )
      )
        return fresh;
      if (!(error instanceof AtomicGuardError)) throw error;
    }
  }
  throw new TaskBillingError('insufficient_credits');
}
