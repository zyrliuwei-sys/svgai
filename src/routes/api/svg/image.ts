import { createFileRoute } from '@tanstack/react-router';
import { archivedTaskSvg } from '@/server/svg-archive';
import { startSvgImageEdit } from '@/server/svg-generation';
import {
  imageEditAvailable,
  serveImageSource,
} from '@/server/svg-image-source';
import { svgViewer } from '@/server/svg-previews';
import { parseImageInput, traceImage } from '@/server/svg-renderer';

import { seeApiCredentials } from '@/core/ai/seeapi-generation';
import { envConfigs } from '@/config';
import { SVG_IMAGE_CREDITS } from '@/config/generation';
import { fulfillSvg, TaskBillingError } from '@/modules/ai-tasks/service';
import { getAllConfigs } from '@/modules/config/service';
import { enforceMinIntervalRateLimit } from '@/lib/rate-limit';
import { readRequestBytes } from '@/lib/request-body';
import { isSameOriginRequest } from '@/lib/request-security';
import { respData, respErr } from '@/lib/resp';
import { svgIdentityHash } from '@/lib/svg-visitor';
import { m } from '@/paraglide/messages.js';

async function POST({ request }: { request: Request }) {
  const limited = enforceMinIntervalRateLimit(request, {
    intervalMs: 1500,
    keyPrefix: 'svg-image-ip',
  });
  if (limited) return limited;
  if (!isSameOriginRequest(request, envConfigs.app_url))
    return respErr(m['svgai.api.not_allowed'](), { status: 403 });
  try {
    const viewer = await svgViewer(request);
    if (!viewer.userId || !viewer.paidOrderId)
      return respErr(m['svgai.trial.payment_required'](), { status: 402 });
    const userLimited = enforceMinIntervalRateLimit(request, {
      intervalMs: 2000,
      keyPrefix: 'svg-image-user',
      extraKey: viewer.userId,
    });
    if (userLimited) return userLimited;
    let body;
    let input;
    try {
      body = JSON.parse(
        new TextDecoder().decode(await readRequestBytes(request, 2_000_000))
      );
      if (
        typeof body.requestId !== 'string' ||
        !/^[a-f0-9-]{36}$/i.test(body.requestId) ||
        (body.method !== undefined && !['trace', 'ai'].includes(body.method))
      )
        throw new Error();
      input = parseImageInput(body);
    } catch {
      return respErr(m['svgai.api.invalid_input'](), { status: 400 });
    }
    const id =
      'image_' + (await svgIdentityHash(`${viewer.userId}:${body.requestId}`));
    if (body.method === 'ai') {
      const credentials = seeApiCredentials(await getAllConfigs());
      if (!credentials || !imageEditAvailable())
        return respErr(m['svgai.api.unavailable'](), { status: 503 });
      return respData(
        await startSvgImageEdit({
          id,
          userId: viewer.userId,
          paidOrderId: viewer.paidOrderId,
          credentials,
          input,
        }),
        { headers: { 'cache-control': 'no-store' } }
      );
    }
    const svg = await traceImage(input);
    const task = await fulfillSvg({
      id,
      userId: viewer.userId,
      paidOrderId: viewer.paidOrderId,
      provider: 'svgai-trace',
      model: 'image-trace',
      options: JSON.stringify({
        imageHash: await svgIdentityHash(input.image),
        colors: input.colors,
        removeBackground: input.removeBackground,
      }),
      svg,
      credits: SVG_IMAGE_CREDITS,
    });
    return respData({
      taskId: task.id,
      status: 'succeeded',
      credits: task.costCredits,
      svg: await archivedTaskSvg(task),
    });
  } catch (error) {
    return respErr(
      error instanceof TaskBillingError
        ? error.code === 'insufficient_credits'
          ? m['svgai.api.insufficient_credits']()
          : error.code === 'request_conflict'
            ? m['svgai.api.request_conflict']()
            : m['svgai.trial.payment_required']()
        : m['svgai.api.temporarily_unavailable'](),
      {
        status:
          error instanceof TaskBillingError
            ? error.code === 'request_conflict'
              ? 409
              : 402
            : 503,
      }
    );
  }
}
export const Route = createFileRoute('/api/svg/image')({
  server: {
    handlers: { POST, GET: ({ request }) => serveImageSource(request) },
  },
});
