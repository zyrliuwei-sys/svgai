import { envConfigs } from '@/config';

const COOKIE = 'svgai_preview_session';
const hex = (bytes: ArrayBuffer) =>
  [...new Uint8Array(bytes)]
    .map((n) => n.toString(16).padStart(2, '0'))
    .join('');
export async function svgIdentityHash(value: string): Promise<string> {
  if (!envConfigs.auth_secret)
    throw new Error('Preview identity is not configured');
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(envConfigs.auth_secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return hex(
    await crypto.subtle.sign(
      'HMAC',
      key,
      new TextEncoder().encode('svgai-preview-v1:' + value)
    )
  );
}
function equal(a: string, b: string) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++)
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}
export async function svgVisitor(request: Request) {
  const cookie = (request.headers.get('cookie') || '')
    .split(';')
    .map((n) => n.trim())
    .find((n) => n.startsWith(COOKIE + '='))
    ?.slice(COOKIE.length + 1);
  let token = cookie?.split('.')[0] || '';
  const signature = cookie?.split('.')[1] || '';
  let valid =
    /^[0-9a-f-]{36}$/i.test(token) &&
    /^[0-9a-f]{64}$/.test(signature) &&
    equal(signature, await svgIdentityHash('cookie:' + token));
  if (!valid) token = crypto.randomUUID();
  const ip =
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'local';
  return {
    visitorHash: await svgIdentityHash('visitor:' + token),
    ipHash: await svgIdentityHash('ip:' + ip),
    clientHash: await svgIdentityHash(
      'client:' + ip + ':' + (request.headers.get('user-agent') || 'unknown')
    ),
    setCookie: valid
      ? undefined
      : `${COOKIE}=${token}.${await svgIdentityHash('cookie:' + token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`,
  };
}
