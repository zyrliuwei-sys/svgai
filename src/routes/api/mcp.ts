import { createFileRoute } from '@tanstack/react-router';
import { handleSvgMcp } from '@/server/svg-mcp';

export const Route = createFileRoute('/api/mcp')({
  server: {
    handlers: {
      POST: ({ request }) => handleSvgMcp(request),
      GET: () =>
        new Response(null, { status: 405, headers: { Allow: 'POST' } }),
      DELETE: () =>
        new Response(null, { status: 405, headers: { Allow: 'POST' } }),
    },
  },
});
