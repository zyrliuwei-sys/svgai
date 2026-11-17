import { createFileRoute } from '@tanstack/react-router';
import { ownedSvgTask } from '@/server/svg-generation';
import { svgViewer, unlockPreview } from '@/server/svg-previews';

import { envConfigs } from '@/config';
import { TaskBillingError } from '@/modules/ai-tasks/service';
import { PreviewError } from '@/modules/svg-previews/service';
import { enforceMinIntervalRateLimit } from '@/lib/rate-limit';
import { readRequestBytes } from '@/lib/request-body';
import { isSameOriginRequest } from '@/lib/request-security';
import { respData, respErr } from '@/lib/resp';
import { SVG_SAMPLES } from '@/lib/svg-samples';
import { m } from '@/paraglide/messages.js';

async function POST({ request }: { request: Request }) {
  const limited = enforceMinIntervalRateLimit(request, {
    intervalMs: 500,
    keyPrefix: 'svg-export-ip',
  });
  if (limited) return limited;
  if (!isSameOriginRequest(request, envConfigs.app_url))
    return respErr(m['svgai.api.not_allowed'](), { status: 403 });
  try {
    const viewer = await svgViewer(request);
    if (!viewer.userId || !viewer.paidOrderId)
      return respErr(m['svgai.trial.payment_required'](), { status: 402 });
    const userLimited = enforceMinIntervalRateLimit(request, {
      intervalMs: 800,
      keyPrefix: 'svg-export-user',
      extraKey: viewer.userId,
    });
    if (userLimited) return userLimited;
    let body;
    try {
      body = JSON.parse(
        new TextDecoder().decode(await readRequestBytes(request, 4096))
      );
      if (!body || typeof body !== 'object' || Array.isArray(body))
        throw new Error();
    } catch {
      return respErr(m['svgai.api.invalid_input'](), { status: 400 });
    }
    if (body.previewId && viewer.preview?.id === body.previewId) {
      const task = await unlockPreview(viewer, viewer.preview!);
      return respData({
        svg: JSON.parse(task.taskResult!).svg,
        taskId: task.id,
        credits: task.costCredits,
      });
    }
    if (typeof body.taskId === 'string') {
      const task = await ownedSvgTask(body.taskId, viewer.userId);
      if (task?.status === 'success' && task.taskResult)
        return respData({
          svg: JSON.parse(task.taskResult).svg,
          taskId: task.id,
          credits: task.costCredits,
        });
    }
    if (typeof body.sampleId === 'string') {
      const sample = SVG_SAMPLES.find((item) => item.id === body.sampleId);
      if (sample) return respData({ svg: sample.svg, credits: 0 });
    }
    return respErr(m['svgai.api.task_not_found'](), { status: 404 });
  } catch (error) {
    if (error instanceof PreviewError)
      return respErr(
        error.code === 'payment_required'
          ? m['svgai.trial.payment_required']()
          : m['svgai.api.task_not_found'](),
        { status: error.code === 'payment_required' ? 402 : 404 }
      );
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
export const Route = createFileRoute('/api/svg/export')({
  server: { handlers: { POST } },
});
