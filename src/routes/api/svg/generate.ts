import { createFileRoute } from '@tanstack/react-router';
import {
  ownedSvgTask,
  refreshSvgGeneration,
  startSvgGeneration,
} from '@/server/svg-generation';
import { imageEditAvailable } from '@/server/svg-image-source';
import { publicPreview, svgViewer } from '@/server/svg-previews';

import { seeApiCredentials } from '@/core/ai/seeapi-generation';
import { getAuth } from '@/core/auth';
import { SVG_RESERVED_CREDITS } from '@/config/generation';
import { TaskBillingError } from '@/modules/ai-tasks/service';
import { getAllConfigs } from '@/modules/config/service';
import { getBalance } from '@/modules/credits/service';
import {
  parseSvgInput,
  SvgGenerationError,
} from '@/modules/svg-generator/service';
import { paidSvgOrder } from '@/modules/svg-previews/service';
import { enforceMinIntervalRateLimit } from '@/lib/rate-limit';
import { respData, respErr } from '@/lib/resp';
import { m } from '@/paraglide/messages.js';

const noStore = { 'cache-control': 'no-store' };
const MAX_INPUT_BYTES = 8192;

async function readBody(request: Request): Promise<unknown> {
  if (
    !request.headers
      .get('content-type')
      ?.toLowerCase()
      .startsWith('application/json')
  )
    throw new SvgGenerationError('invalid_input');
  if (
    Number(request.headers.get('content-length')) > MAX_INPUT_BYTES ||
    !request.body
  )
    throw new SvgGenerationError('invalid_input');
  const reader = request.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let total = 0;
  let text = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_INPUT_BYTES) {
        await reader.cancel();
        throw new SvgGenerationError('invalid_input');
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return JSON.parse(text);
  } catch {
    throw new SvgGenerationError('invalid_input');
  } finally {
    reader.releaseLock();
  }
}

async function GET({ request }: { request: Request }) {
  const taskId = new URL(request.url).searchParams.get('taskId');
  const ipLimited = enforceMinIntervalRateLimit(request, {
    intervalMs: 500,
    keyPrefix: taskId ? 'svg-task-ip' : 'svg-availability-ip',
  });
  if (ipLimited) return ipLimited;
  if (taskId && request.headers.get('sec-fetch-site') === 'cross-site')
    return respErr(m['svgai.api.not_allowed'](), {
      status: 403,
      headers: noStore,
    });
  try {
    const credentials = seeApiCredentials(await getAllConfigs());
    if (!taskId) {
      const viewer = await svgViewer(request);
      const headers = new Headers(noStore);
      if (viewer.setCookie) headers.set('set-cookie', viewer.setCookie);
      return respData(
        {
          ready: Boolean(credentials),
          imageEdit: Boolean(credentials && imageEditAvailable()),
          reservedCredits: SVG_RESERVED_CREDITS,
          balance: viewer.userId ? await getBalance(viewer.userId) : null,
          paid: Boolean(viewer.paidOrderId),
          canPreview:
            !viewer.paidOrderId &&
            ((!viewer.preview && !viewer.clientUsed) ||
              (viewer.preview?.status === 'failed' &&
                viewer.preview.attempt < 3)),
          preview: viewer.preview ? publicPreview(viewer.preview) : null,
        },
        { headers }
      );
    }
    const session = await getAuth().api.getSession({
      headers: request.headers,
    });
    if (!session?.user)
      return respErr(m['svgai.api.sign_in'](), {
        status: 401,
        headers: noStore,
      });
    if (!(await paidSvgOrder(session.user.id)))
      return respErr(m['svgai.trial.payment_required'](), {
        status: 402,
        headers: noStore,
      });
    const limited = enforceMinIntervalRateLimit(request, {
      intervalMs: 1500,
      keyPrefix: 'svg-poll',
      extraKey: session.user.id,
    });
    if (limited) return limited;
    const task = await ownedSvgTask(taskId, session.user.id);
    if (!task)
      return respErr(m['svgai.api.task_not_found'](), {
        status: 404,
        headers: noStore,
      });
    if (!credentials && !['success', 'failed'].includes(task.status))
      return respErr(m['svgai.api.unavailable'](), {
        status: 503,
        headers: noStore,
      });
    return respData(await refreshSvgGeneration(task, credentials!), {
      headers: noStore,
    });
  } catch {
    return respErr(m['svgai.api.temporarily_unavailable'](), {
      status: 503,
      headers: noStore,
    });
  }
}

async function POST({ request }: { request: Request }) {
  const limited = enforceMinIntervalRateLimit(request, {
    intervalMs: 2000,
    keyPrefix: 'svg-generate-ip',
  });
  if (limited) return limited;
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin)
    return respErr(m['svgai.api.not_allowed'](), {
      status: 403,
      headers: noStore,
    });
  try {
    const session = await getAuth().api.getSession({
      headers: request.headers,
    });
    if (!session?.user || (session.user as { type?: string }).type === 'api')
      return respErr(m['svgai.api.sign_in'](), {
        status: 401,
        headers: noStore,
      });
    const paidOrderId = await paidSvgOrder(session.user.id);
    if (!paidOrderId)
      return respErr(m['svgai.trial.payment_required'](), {
        status: 402,
        headers: noStore,
      });
    const userLimited = enforceMinIntervalRateLimit(request, {
      intervalMs: 3000,
      keyPrefix: 'svg-generate-user',
      extraKey: session.user.id,
    });
    if (userLimited) return userLimited;
    const body = (await readBody(request)) as Record<string, unknown>;
    const input = parseSvgInput(body);
    if (
      typeof body.requestId !== 'string' ||
      !/^[a-f0-9-]{36}$/i.test(body.requestId)
    )
      throw new SvgGenerationError('invalid_input');
    const credentials = seeApiCredentials(await getAllConfigs());
    if (!credentials)
      return respErr(m['svgai.api.unavailable'](), {
        status: 503,
        headers: noStore,
      });
    return respData(
      await startSvgGeneration({
        userId: session.user.id,
        requestId: body.requestId,
        input,
        credentials,
        paidOrderId,
      }),
      { headers: noStore }
    );
  } catch (error) {
    if (error instanceof TaskBillingError)
      return respErr(
        error.code === 'insufficient_credits'
          ? m['svgai.api.insufficient_credits']()
          : m['svgai.api.request_conflict'](),
        {
          status: error.code === 'insufficient_credits' ? 402 : 409,
          headers: noStore,
        }
      );
    if (error instanceof SvgGenerationError)
      return respErr(m['svgai.api.invalid_input'](), {
        status: 400,
        headers: noStore,
      });
    return respErr(m['svgai.api.temporarily_unavailable'](), {
      status: 503,
      headers: noStore,
    });
  }
}

export const Route = createFileRoute('/api/svg/generate')({
  server: { handlers: { GET, POST } },
});
