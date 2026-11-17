import { createFileRoute } from '@tanstack/react-router';
import {
  publicPreview,
  refreshPreview,
  svgViewer,
} from '@/server/svg-previews';
import { parseImageInput } from '@/server/svg-renderer';

import { seeApiCredentials } from '@/core/ai/seeapi-generation';
import { envConfigs } from '@/config';
import { getAllConfigs } from '@/modules/config/service';
import { parseSvgInput } from '@/modules/svg-generator/service';
import { claimPreview, PreviewError } from '@/modules/svg-previews/service';
import { enforceMinIntervalRateLimit } from '@/lib/rate-limit';
import { readRequestBytes } from '@/lib/request-body';
import { isSameOriginRequest } from '@/lib/request-security';
import { respData, respErr } from '@/lib/resp';
import { svgIdentityHash } from '@/lib/svg-visitor';
import { m } from '@/paraglide/messages.js';

const headers = { 'cache-control': 'no-store', vary: 'Cookie' };
function errorResponse(error: unknown, extra: HeadersInit = headers) {
  if (error instanceof PreviewError)
    return respErr(
      error.code === 'trial_used'
        ? m['svgai.trial.used']()
        : error.code === 'trial_limit'
          ? m['svgai.trial.limit']()
          : m['svgai.api.task_not_found'](),
      {
        status:
          error.code === 'trial_used'
            ? 402
            : error.code === 'trial_limit'
              ? 429
              : 404,
        headers: extra,
      }
    );
  return respErr(m['svgai.api.temporarily_unavailable'](), {
    status: 503,
    headers: extra,
  });
}
async function GET({ request }: { request: Request }) {
  const limited = enforceMinIntervalRateLimit(request, {
    intervalMs: 500,
    keyPrefix: 'svg-preview-read',
  });
  if (limited) return limited;
  if (request.headers.get('sec-fetch-site') === 'cross-site')
    return respErr(m['svgai.api.not_allowed'](), { status: 403, headers });
  try {
    const viewer = await svgViewer(request);
    const responseHeaders = new Headers(headers);
    if (viewer.setCookie) responseHeaders.set('set-cookie', viewer.setCookie);
    const asset = new URL(request.url).searchParams.get('asset');
    if (asset) {
      if (
        !viewer.preview ||
        viewer.preview.id !== asset ||
        viewer.preview.status !== 'succeeded' ||
        !viewer.preview.previewPng
      )
        throw new PreviewError('not_found');
      responseHeaders.set('content-type', 'image/png');
      responseHeaders.set('x-content-type-options', 'nosniff');
      return new Response(
        new Uint8Array(Buffer.from(viewer.preview.previewPng, 'base64')),
        { headers: responseHeaders }
      );
    }
    const userLimited =
      viewer.userId &&
      enforceMinIntervalRateLimit(request, {
        intervalMs: 1500,
        keyPrefix: 'svg-preview-poll',
        extraKey: viewer.userId,
      });
    if (userLimited) return userLimited;
    const row = viewer.preview
      ? await refreshPreview(viewer.preview)
      : undefined;
    return respData(row ? publicPreview(row) : null, {
      headers: responseHeaders,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
async function POST({ request }: { request: Request }) {
  const limited = enforceMinIntervalRateLimit(request, {
    intervalMs: 2500,
    keyPrefix: 'svg-preview-create',
  });
  if (limited) return limited;
  if (!isSameOriginRequest(request, envConfigs.app_url))
    return respErr(m['svgai.api.not_allowed'](), { status: 403, headers });
  const responseHeaders = new Headers(headers);
  try {
    const viewer = await svgViewer(request);
    if (viewer.setCookie) responseHeaders.set('set-cookie', viewer.setCookie);
    if (viewer.paidOrderId)
      return respErr(m['svgai.trial.use_paid'](), {
        status: 402,
        headers: responseHeaders,
      });
    if (!viewer.preview && viewer.clientUsed)
      throw new PreviewError('trial_used');
    const userLimited =
      viewer.userId &&
      enforceMinIntervalRateLimit(request, {
        intervalMs: 3000,
        keyPrefix: 'svg-preview-create-user',
        extraKey: viewer.userId,
      });
    if (userLimited) return userLimited;
    let input: {
      mode: 'text' | 'image';
      options:
        ReturnType<typeof parseSvgInput> | ReturnType<typeof parseImageInput>;
    };
    try {
      if (!request.headers.get('content-type')?.startsWith('application/json'))
        throw new Error();
      const body = JSON.parse(
        new TextDecoder('utf-8', { fatal: true }).decode(
          await readRequestBytes(request, 2_000_000)
        )
      );
      if (body.mode !== 'text' && body.mode !== 'image') throw new Error();
      input = {
        mode: body.mode,
        options:
          body.mode === 'text' ? parseSvgInput(body) : parseImageInput(body),
      };
    } catch {
      return respErr(m['svgai.api.invalid_input'](), {
        status: 400,
        headers: responseHeaders,
      });
    }
    if (input.mode === 'text' && !seeApiCredentials(await getAllConfigs()))
      return respErr(m['svgai.api.unavailable'](), {
        status: 503,
        headers: responseHeaders,
      });
    const row = await claimPreview({
      visitorHash: viewer.visitorHash,
      userId: viewer.userId,
      ipHash: viewer.ipHash,
      clientHash: viewer.clientHash,
      inputHash: await svgIdentityHash('input:' + JSON.stringify(input)),
      mode: input.mode,
      options: JSON.stringify(input.options),
    });
    return respData(publicPreview(await refreshPreview(row)), {
      headers: responseHeaders,
    });
  } catch (error) {
    return errorResponse(error, responseHeaders);
  }
}
export const Route = createFileRoute('/api/svg/preview')({
  server: { handlers: { GET, POST } },
});
