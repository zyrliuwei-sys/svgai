import { SVG_MODEL } from '@/config/generation';
import { normalizeSeeApiConfigs } from '@/config/seeapi';

export class SeeApiError extends Error {
  constructor(public readonly status: number = 502) {
    super('The image service could not complete this request.');
    this.name = 'SeeApiError';
  }
  get rejected() {
    return [400, 401, 402, 403, 404, 413, 422].includes(this.status);
  }
}

export interface SeeApiGeneration {
  id: string;
  status:
    'processing' | 'succeeded' | 'failed' | 'canceled' | 'refunded' | 'expired';
  consumedCredits?: number;
  assets: { url: string; mimeType: string }[];
}

export function seeApiCredentials(configs: Record<string, string | undefined>) {
  const apiKey = configs.seeapi_api_key?.trim();
  if (!apiKey || apiKey.startsWith('••••••••') || apiKey.includes('*'))
    return undefined;
  return {
    apiKey,
    baseUrl: normalizeSeeApiConfigs({
      seeapi_base_url: configs.seeapi_base_url || '',
    }).seeapi_base_url,
  };
}

async function generationRequest(
  credentials: { apiKey: string; baseUrl: string },
  path: string,
  init: RequestInit = {}
): Promise<SeeApiGeneration> {
  try {
    const baseUrl = normalizeSeeApiConfigs({
      seeapi_base_url: credentials.baseUrl,
    }).seeapi_base_url;
    const response = await fetch(`${baseUrl}/v1/generations${path}`, {
      ...init,
      // Workers rejects "error" before sending. Manual also prevents the key
      // from following a redirect; non-2xx responses are rejected below.
      redirect: 'manual',
      signal: AbortSignal.timeout(25_000),
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${credentials.apiKey}`,
        ...init.headers,
      },
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new SeeApiError(response.status);
    }
    const data = (await response.json()) as {
      generation?: Record<string, unknown>;
    };
    const g = data.generation;
    const states = [
      'processing',
      'succeeded',
      'failed',
      'canceled',
      'refunded',
      'expired',
    ];
    if (
      !g ||
      typeof g.id !== 'string' ||
      !/^[\w-]{1,255}$/.test(g.id) ||
      !states.includes(String(g.status))
    )
      throw new SeeApiError();
    const assets = (
      g.result as
        { assets?: { url?: unknown; mime_type?: unknown }[] } | undefined
    )?.assets;
    return {
      id: g.id,
      status: g.status as SeeApiGeneration['status'],
      consumedCredits:
        typeof g.consumed_credits === 'number' ? g.consumed_credits : undefined,
      assets: Array.isArray(assets)
        ? assets
            .filter((a) => typeof a.url === 'string')
            .map((a) => ({
              url: a.url as string,
              mimeType: typeof a.mime_type === 'string' ? a.mime_type : '',
            }))
        : [],
    };
  } catch (error) {
    if (error instanceof SeeApiError) throw error;
    throw new SeeApiError();
  }
}

export function createSeeApiGeneration(
  credentials: { apiKey: string; baseUrl: string },
  params: { idempotencyKey: string; prompt: string; aspect: string }
) {
  return generationRequest(credentials, '', {
    method: 'POST',
    headers: { 'Idempotency-Key': params.idempotencyKey },
    body: JSON.stringify({
      model: SVG_MODEL,
      endpoint: 'text-to-image',
      provider: 'seeapi',
      input: {
        prompt: params.prompt,
        aspect_ratio: params.aspect,
        resolution: '1K',
        quality: 'medium',
        complexity: 'high',
        output_format: 'svg',
        background: 'auto',
        moderation: 'auto',
      },
    }),
  });
}

export function createSeeApiImageEdit(
  credentials: { apiKey: string; baseUrl: string },
  params: {
    idempotencyKey: string;
    sourceUrl: string;
    colors: number;
    removeBackground: boolean;
  }
) {
  const backdrop = params.removeBackground
    ? 'Isolate the original subject on a truly transparent background. Remove the scene and cast shadows.'
    : 'Keep the original framing and simplify the background into a few broad shapes.';
  return generationRequest(credentials, '', {
    method: 'POST',
    headers: { 'Idempotency-Key': params.idempotencyKey },
    body: JSON.stringify({
      model: SVG_MODEL,
      endpoint: 'image-to-image',
      provider: 'seeapi',
      input: {
        prompt: `Turn this reference into a clean flat vector-style illustration for automatic tracing. Preserve the subject's likeness, pose, silhouette, crop, clothing and key colors. Keep natural skin tones and readable facial details. Use at most ${params.colors} broad, solid color fills with smooth closed boundaries. Simplify gradients, shadows and fine textures into intentional shapes. Do not add lettering, halftone, grain or new elements. ${backdrop}`,
        input_images: [params.sourceUrl],
        aspect_ratio: 'auto',
        resolution: '1K',
        quality: 'medium',
        complexity: 'high',
        output_format: 'png',
        background: params.removeBackground ? 'transparent' : 'opaque',
        moderation: 'auto',
      },
    }),
  });
}

export async function getSeeApiGeneration(
  credentials: { apiKey: string; baseUrl: string },
  id: string
) {
  const generation = await generationRequest(
    credentials,
    `/${encodeURIComponent(id)}`
  );
  if (generation.id !== id) throw new SeeApiError();
  return generation;
}

/** Assets are fetched anonymously from SeeAPI only. */
export async function downloadSeeApiAsset(url: string, maxBytes: number) {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new SeeApiError(422);
  }
  if (
    parsed.protocol !== 'https:' ||
    ![
      'assets.seeapi.com',
      'api.seeapi.com',
      'www.seeapi.com',
      'seeapi.com',
    ].includes(parsed.hostname) ||
    parsed.username ||
    parsed.password ||
    parsed.port
  )
    throw new SeeApiError(422);
  const response = await fetch(parsed.href, {
    redirect: 'manual',
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok || !response.body) {
    await response.body?.cancel();
    throw new SeeApiError(response.ok ? 422 : response.status);
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.length;
      if (bytes > maxBytes) {
        await reader.cancel();
        throw new SeeApiError(413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

export async function downloadSeeApiSvg(url: string): Promise<string> {
  return new TextDecoder('utf-8', { fatal: true }).decode(
    await downloadSeeApiAsset(url, 1_500_000)
  );
}
