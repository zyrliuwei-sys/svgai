import { createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';

import { productPageHead } from '@/lib/seo';
import { m } from '@/paraglide/messages.js';
import { getLocale } from '@/paraglide/runtime.js';
import { Footer } from '@/blocks/footer';
import { GuestPostLanding } from '@/blocks/guest-post';
import { Header } from '@/blocks/header';

const getPublicInfo = createServerFn().handler(async () => {
  const { getGuestPostPublicInfo } =
    await import('@/server/guest-posts/public-info');
  return getGuestPostPublicInfo();
});

export const Route = createFileRoute('/guest-post')({
  loader: async () => {
    const locale = getLocale();
    return {
      title: m['guest_posts.landing.title']({}, { locale }),
      description: m['guest_posts.landing.description']({}, { locale }),
      info: await getPublicInfo(),
    };
  },
  head: ({ loaderData }) =>
    loaderData
      ? productPageHead({
          path: '/guest-post',
          title: loaderData.title,
          description: loaderData.description,
        })
      : {},
  component: GuestPostPage,
});

function GuestPostPage() {
  const { info } = Route.useLoaderData();
  return (
    <div className="svgai-page bg-background text-foreground flex min-h-screen flex-col">
      <Header />
      <main id="main-content" tabIndex={-1} className="flex-1">
        <GuestPostLanding initialInfo={info} />
      </main>
      <Footer />
    </div>
  );
}
