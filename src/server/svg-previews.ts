import {
  createSeeApiGeneration,
  downloadSeeApiSvg,
  getSeeApiGeneration,
  seeApiCredentials,
  SeeApiError,
} from '@/core/ai/seeapi-generation';
import { getAuth } from '@/core/auth';
import { generationCredits, SVG_IMAGE_CREDITS } from '@/config/generation';
import { fulfillSvg } from '@/modules/ai-tasks/service';
import { getAllConfigs } from '@/modules/config/service';
import { parseSvgInput } from '@/modules/svg-generator/service';
import {
  attachPreview,
  bindPreview,
  clientPreviewUsed,
  completePreview,
  paidSvgOrder,
  PreviewError,
  visitorPreview,
  type Preview,
} from '@/modules/svg-previews/service';
import { getSvgStats, outlineSvg, sanitizeSvg } from '@/lib/svg-vectorizer';
import { svgVisitor } from '@/lib/svg-visitor';

import { providerPrompt } from './svg-generation';
import { parseImageInput, rasterizeSvg, traceImage } from './svg-renderer';

export async function svgViewer(request: Request) {
  const identity = await svgVisitor(request);
  const session = await getAuth().api.getSession({ headers: request.headers });
  const userId =
    session?.user && (session.user as { type?: string }).type !== 'api'
      ? session.user.id
      : undefined;
  let preview = await visitorPreview(identity.visitorHash, userId);
  if (preview && userId && !preview.userId)
    preview = await bindPreview(preview, identity.visitorHash, userId);
  const paidOrderId = await paidSvgOrder(userId);
  const clientUsed = await clientPreviewUsed(identity.clientHash);
  return { ...identity, userId, preview, paidOrderId, clientUsed };
}
export function publicPreview(row: Preview) {
  return {
    previewId: row.id,
    mode: row.mode,
    status:
      row.status === 'succeeded'
        ? 'succeeded'
        : row.status === 'failed'
          ? 'failed'
          : 'processing',
    locked: true,
    credits: row.costCredits,
    ...(row.status === 'succeeded'
      ? {
          previewUrl: `/api/svg/preview?asset=${encodeURIComponent(row.id)}`,
          stats: JSON.parse(row.stats || '{}'),
        }
      : {}),
  };
}

/** Raster-only comparison views for the preview already scoped to this viewer. */
export async function renderPreviewAsset(
  row: Preview | undefined,
  assetId: string,
  outline = false
): Promise<Uint8Array> {
  if (
    !row ||
    row.id !== assetId ||
    row.status !== 'succeeded' ||
    !row.previewPng ||
    (outline && !row.svg)
  )
    throw new PreviewError('not_found');
  const png = outline
    ? await rasterizeSvg(outlineSvg(row.svg!))
    : row.previewPng;
  return new Uint8Array(Buffer.from(png, 'base64'));
}

export async function refreshPreview(row: Preview) {
  if (['succeeded', 'failed'].includes(row.status)) return row;
  const input = JSON.parse(row.options);
  let svg: string;
  let credits = SVG_IMAGE_CREDITS;
  if (row.mode === 'image') {
    try {
      svg = await traceImage(parseImageInput(input));
    } catch {
      return completePreview(row, null);
    }
  } else {
    const credentials = seeApiCredentials(await getAllConfigs());
    if (!credentials) throw new SeeApiError(503);
    let generation;
    try {
      if (!row.providerTaskId) {
        const parsed = parseSvgInput(input);
        generation = await createSeeApiGeneration(credentials, {
          idempotencyKey: `preview_${row.id}_${row.attempt}`,
          prompt: providerPrompt(parsed),
          aspect: parsed.aspect,
        });
        row = await attachPreview(row, generation.id);
      } else
        generation = await getSeeApiGeneration(credentials, row.providerTaskId);
    } catch (error) {
      if (error instanceof SeeApiError && error.rejected)
        return completePreview(row, null);
      throw error;
    }
    if (
      generation.status === 'processing' ||
      (generation.status === 'succeeded' &&
        generation.consumedCredits === undefined)
    )
      return row;
    if (generation.status !== 'succeeded') return completePreview(row, null);
    credits = generationCredits(generation.consumedCredits!);
    const asset = generation.assets.find(
      (a) =>
        a.mimeType === 'image/svg+xml' ||
        new URL(a.url).pathname.endsWith('.svg')
    );
    if (!asset) return completePreview(row, null);
    const raw = await downloadSeeApiSvg(asset.url);
    try {
      svg = sanitizeSvg(
        raw.replace(/<(?:title|desc)\b[^>]*>[\s\S]*?<\/(?:title|desc)>/gi, '')
      );
    } catch {
      return completePreview(row, null);
    }
  }
  try {
    const stats = getSvgStats(svg);
    if (
      stats.bytes > 250_000 ||
      (!stats.paths &&
        !/<(?:rect|circle|ellipse|polygon|polyline|line)\b/.test(svg))
    )
      return completePreview(row, null);
    const previewPng = await rasterizeSvg(svg);
    return completePreview(row, {
      svg,
      previewPng,
      credits,
      stats: JSON.stringify(stats),
    });
  } catch {
    return completePreview(row, null);
  }
}
export async function unlockPreview(
  viewer: Awaited<ReturnType<typeof svgViewer>>,
  row: Preview
) {
  if (!viewer.userId || !viewer.paidOrderId)
    throw new PreviewError('payment_required');
  row = await bindPreview(row, viewer.visitorHash, viewer.userId);
  if (row.status !== 'succeeded' || !row.svg)
    throw new PreviewError('not_found');
  return fulfillSvg({
    id: `preview_unlock_${row.id}`,
    userId: viewer.userId,
    paidOrderId: viewer.paidOrderId,
    provider: 'svgai-preview',
    model: row.mode === 'text' ? 'gpt-image-2-6-sunburst' : 'image-trace',
    options: JSON.stringify({ previewId: row.id }),
    svg: row.svg,
    credits: row.costCredits,
  });
}
