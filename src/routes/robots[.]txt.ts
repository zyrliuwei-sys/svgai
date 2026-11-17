import { createFileRoute } from '@tanstack/react-router';

import { SITE_URL } from '@/config/site';

export const Route = createFileRoute('/robots.txt')({
  server: {
    handlers: {
      GET: () => {
        const body = [
          'User-Agent: *',
          'Allow: /',
          'Disallow: /admin',
          'Disallow: /settings',
          'Disallow: /api/',
          'Disallow: /sign-in',
          'Disallow: /sign-up',
          'Disallow: /forgot-password',
          'Disallow: /reset-password',
          'Disallow: /verify-email',
          'Disallow: /auth-callback',
          'Disallow: /redeem-invite',
          'Disallow: /*?*',
          '',
          `Sitemap: ${SITE_URL}/sitemap.xml`,
          '',
        ].join('\n');
        return new Response(body, {
          headers: { 'Content-Type': 'text/plain' },
        });
      },
    },
  },
});
