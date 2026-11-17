/** Browser cookie writes must originate on this application, including behind a proxy. */
export function isSameOriginRequest(
  request: Request,
  publicOrigin: string
): boolean {
  if (request.headers.get('sec-fetch-site') === 'cross-site') return false;
  const origin = request.headers.get('origin');
  if (!origin) return request.headers.get('sec-fetch-site') === 'same-origin';
  const origins = [new URL(request.url).origin];
  try {
    origins.push(new URL(publicOrigin).origin);
  } catch {
    // A missing public URL cannot expand the trusted origins.
  }
  return origins.includes(origin);
}

export function isPrivatePath(pathname: string): boolean {
  return (
    /^\/(?:admin|settings|api)(?:\/|$)/.test(pathname) ||
    /^\/(?:sign-in|sign-up|forgot-password|reset-password|verify-email|auth-callback|redeem-invite)\/?$/.test(
      pathname
    )
  );
}

/** Headers apply to pages, redirects and API errors as well as successful responses. */
export function secureResponse(response: Response, pathname: string): Response {
  const copy = new Response(response.body, response);
  copy.headers.delete('X-Powered-By');
  copy.headers.set('X-Content-Type-Options', 'nosniff');
  copy.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (isPrivatePath(pathname)) copy.headers.set('Cache-Control', 'no-store');
  if (isPrivatePath(pathname) || response.status >= 400)
    copy.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return copy;
}
