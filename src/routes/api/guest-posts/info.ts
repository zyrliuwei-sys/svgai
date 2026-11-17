import { createFileRoute } from '@tanstack/react-router';
import { getGuestPostPublicInfo } from '@/server/guest-posts/public-info';

import { respData } from '@/lib/resp';

// Public: whether guest posts are open, the rules and the packages.
async function GET() {
  return respData(await getGuestPostPublicInfo());
}

export const Route = createFileRoute('/api/guest-posts/info')({
  server: { handlers: { GET } },
});
