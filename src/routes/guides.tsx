import { createFileRoute } from '@tanstack/react-router';

import { productPageHead } from '@/lib/seo';
import { m } from '@/paraglide/messages.js';
import { getLocale } from '@/paraglide/runtime.js';
import { Footer } from '@/blocks/footer';
import { GuideShelf } from '@/blocks/guides';
import { Header } from '@/blocks/header';
import { getGuidesFn } from '@/content/posts/server';

export const Route = createFileRoute('/guides')({
  loader: () => getGuidesFn({ data: { locale: getLocale() } }),
  head: () =>
    productPageHead({
      path: '/guides',
      title: m['guides.title'](),
      description: m['guides.description'](),
      breadcrumb: m['guides.title'](),
    }),
  component: GuidesPage,
});

function GuidesPage() {
  const guides = Route.useLoaderData();

  return (
    <div className="svgai-page svg-inner-page bg-background text-foreground flex min-h-screen flex-col">
      <Header />
      <main id="main-content" tabIndex={-1} className="flex-1">
        <div className="svgai-container svg-inner-intro">
          <h1>{m['guides.title']()}</h1>
          <p>{m['guides.description']()}</p>
        </div>
        <div className="svgai-container pb-16 md:pb-24">
          <GuideShelf guides={guides} headingLevel={2} />
        </div>
      </main>
      <Footer />
    </div>
  );
}
