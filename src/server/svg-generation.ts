import type { SvgGenerationResult } from '@/types/svg-generator';

import {
  createSeeApiGeneration,
  downloadSeeApiSvg,
  getSeeApiGeneration,
  seeApiCredentials,
  SeeApiError,
} from '@/core/ai/seeapi-generation';
import type { aiTask } from '@/config/db/schema';
import {
  generationCredits,
  SVG_MODEL,
  SVG_RESERVED_CREDITS,
} from '@/config/generation';
import {
  attachGeneration,
  findTask,
  reserveGeneration,
  settleGeneration,
  TaskBillingError,
} from '@/modules/ai-tasks/service';
import {
  parseSvgInput,
  SvgGenerationError,
  type SvgInput,
} from '@/modules/svg-generator/service';
import { getSvgStats, sanitizeSvg } from '@/lib/svg-vectorizer';

import { archivedTaskSvg } from './svg-archive';

type Task = typeof aiTask.$inferSelect;
type Credentials = NonNullable<ReturnType<typeof seeApiCredentials>>;

export async function ownedSvgTask(
  id: string,
  userId: string
): Promise<Task | undefined> {
  const task = (await findTask(id)) as Task | undefined;
  return task?.userId === userId &&
    task.scene === 'svg' &&
    ['seeapi', 'svgai-trace', 'svgai-preview'].includes(task.provider)
    ? task
    : undefined;
}

async function taskResult(task: Task): Promise<SvgGenerationResult> {
  return {
    taskId: task.id,
    status:
      task.status === 'success'
        ? 'succeeded'
        : task.status === 'failed'
          ? 'failed'
          : 'processing',
    credits: task.costCredits,
    ...(task.status === 'success' ? { svg: await archivedTaskSvg(task) } : {}),
  };
}

export function providerPrompt(input: SvgInput) {
  return `${input.prompt}\nCreate a ${input.style} as a compact editable vector SVG. Use clean paths, basic geometric shapes and flat solid hex fills, with a viewBox. No embedded raster images, text, CSS, gradients, filters, masks, clip paths, scripts or external references. Use presentation attributes for all colors and strokes. Keep the SVG under 200 KB.`;
}

export async function startSvgGeneration(params: {
  userId: string;
  requestId: string;
  input: SvgInput;
  credentials: Credentials;
  paidOrderId?: string;
}) {
  const bytes = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${params.userId}:${params.requestId}`)
  );
  const id =
    'svg_' +
    Array.from(new Uint8Array(bytes), (b) =>
      b.toString(16).padStart(2, '0')
    ).join('');
  const task = await reserveGeneration({
    id,
    userId: params.userId,
    model: SVG_MODEL,
    prompt: params.input.prompt,
    options: JSON.stringify(params.input),
    credits: SVG_RESERVED_CREDITS,
    paidOrderId: params.paidOrderId,
  });
  return refreshSvgGeneration(task, params.credentials);
}

export async function refreshSvgGeneration(
  task: Task,
  credentials: Credentials
): Promise<SvgGenerationResult> {
  if (task.status === 'success' || task.status === 'failed')
    return taskResult(task);
  let providerTask;
  if (!task.taskId) {
    const input = parseSvgInput(JSON.parse(task.options || '{}'));
    try {
      providerTask = await createSeeApiGeneration(credentials, {
        idempotencyKey: task.id,
        prompt: providerPrompt(input),
        aspect: input.aspect,
      });
    } catch (error) {
      // A timeout/409/5xx can still mean the upstream accepted it. Keep the reservation
      // and retry the SAME idempotency key; only a definitive rejection is refunded.
      if (error instanceof SeeApiError && error.rejected) {
        return taskResult(
          await settleGeneration({
            taskId: task.id,
            credits: 0,
            failed: true,
            result: { reason: 'provider_rejected' },
          })
        );
      }
      throw error;
    }
    task = await attachGeneration(task.id, providerTask.id);
  } else providerTask = await getSeeApiGeneration(credentials, task.taskId);
  if (providerTask.status === 'processing') return taskResult(task);
  if (providerTask.status !== 'succeeded')
    return taskResult(
      await settleGeneration({
        taskId: task.id,
        credits: 0,
        failed: true,
        result: { reason: 'generation_failed' },
      })
    );
  // Missing billing data is still pending, never silently a free generation.
  if (providerTask.consumedCredits === undefined) return taskResult(task);
  const credits = generationCredits(providerTask.consumedCredits);
  const asset = providerTask.assets.find(
    (asset) =>
      asset.mimeType === 'image/svg+xml' ||
      new URL(asset.url).pathname.endsWith('.svg')
  );
  if (!asset)
    return taskResult(
      await settleGeneration({
        taskId: task.id,
        credits: 0,
        failed: true,
        result: { reason: 'invalid_output' },
      })
    );
  let svg: string;
  try {
    const raw = await downloadSeeApiSvg(asset.url);
    svg = sanitizeSvg(
      raw.replace(/<(?:title|desc)\b[^>]*>[\s\S]*?<\/(?:title|desc)>/gi, '')
    );
    if (
      getSvgStats(svg).paths === 0 &&
      !/<(?:rect|circle|ellipse|polygon|polyline|line)\b/.test(svg)
    )
      throw new SvgGenerationError('invalid_svg');
  } catch (error) {
    // Download errors may be transient: retain task and retry without resubmitting.
    if (error instanceof SeeApiError) throw error;
    return taskResult(
      await settleGeneration({
        taskId: task.id,
        credits: 0,
        failed: true,
        result: { reason: 'invalid_output' },
      })
    );
  }
  try {
    return taskResult(
      await settleGeneration({
        taskId: task.id,
        credits,
        failed: false,
        result: {
          svg,
          providerCredits: providerTask.consumedCredits,
          multiplier: 8,
        },
      })
    );
  } catch (error) {
    if (
      error instanceof TaskBillingError &&
      error.code === 'insufficient_credits'
    )
      return {
        taskId: task.id,
        status: 'awaiting_credits',
        credits,
        requiredCredits: Math.max(0, credits - task.costCredits),
      };
    throw error;
  }
}
