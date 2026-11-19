import { timingSafeEqual } from 'node:crypto';

import { envConfigs } from '@/config';
import { svgIdentityHash } from '@/lib/svg-visitor';

interface SourceBucket {
  put(
    key: string,
    bytes: Uint8Array,
    options: { onlyIf: Headers }
  ): Promise<unknown>;
  head(key: string): Promise<unknown>;
  get(key: string): Promise<{ body: ReadableStream } | null>;
  delete(key: string): Promise<void>;
}

type Env = { SVG_ARCHIVE?: SourceBucket };
const sourceKey = (id: string) => `image-inputs/${id}.png`;
const lifetimeMs = 20 * 60_000;
const sourceHeaders = { 'cache-control': 'private, no-store' };

function sourceBucket() {
  const runtime = globalThis as typeof globalThis & {
    __CF_ENV__?: Env;
    __env__?: Env;
  };
  return (runtime.__CF_ENV__ ?? runtime.__env__)?.SVG_ARCHIVE;
}

export function imageEditAvailable() {
  return !!sourceBucket() && new URL(envConfigs.app_url).protocol === 'https:';
}

export function imageSourceExpires(createdAt: Date) {
  return createdAt.getTime() + lifetimeMs;
}

export async function stageImageSource(id: string, image: string) {
  const bucket = sourceBucket();
  if (!bucket) throw new Error('Image input storage is unavailable');
  await bucket.put(sourceKey(id), Buffer.from(image, 'base64'), {
    onlyIf: new Headers({ 'if-none-match': '*' }),
  });
}

export async function imageSourceUrl(id: string, expires: number) {
  if (!(await sourceBucket()?.head(sourceKey(id)))) return;
  const url = new URL('/api/svg/image', envConfigs.app_url);
  url.searchParams.set('source', id);
  url.searchParams.set('expires', String(expires));
  url.searchParams.set(
    'sig',
    await svgIdentityHash(`image-source:${id}:${expires}`)
  );
  return url.href;
}

export async function serveImageSource(request: Request) {
  const query = new URL(request.url).searchParams;
  const id = query.get('source') ?? '';
  const expires = Number(query.get('expires'));
  const signature = query.get('sig') ?? '';
  const missing = () =>
    new Response(null, { status: 404, headers: sourceHeaders });
  if (
    !/^image_[a-f0-9]{64}$/.test(id) ||
    !/^[a-f0-9]{64}$/.test(signature) ||
    !Number.isSafeInteger(expires) ||
    expires <= Date.now() ||
    expires > Date.now() + lifetimeMs
  )
    return missing();
  const expected = await svgIdentityHash(`image-source:${id}:${expires}`);
  if (
    !timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(signature, 'hex')
    )
  )
    return missing();
  const object = await sourceBucket()?.get(sourceKey(id));
  if (!object) return missing();
  return new Response(object.body, {
    headers: {
      ...sourceHeaders,
      'content-type': 'image/png',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
      'x-robots-tag': 'noindex, noimageindex',
    },
  });
}

export async function deleteImageSource(id: string) {
  try {
    await sourceBucket()?.delete(sourceKey(id));
  } catch {
    // The bucket lifecycle also removes abandoned uploads.
    console.warn('[svg-image] Could not remove temporary input');
  }
}
