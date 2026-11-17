import { createFileRoute } from '@tanstack/react-router';

import { productPageHead } from '@/lib/seo';
import { m } from '@/paraglide/messages.js';
import { GuidePage } from '@/blocks/svg-inner-pages';

export const Route = createFileRoute('/how-it-works')({
  head: () =>
    productPageHead({
      path: '/how-it-works',
      title: m['svgai.inner.guide.title'](),
      description: m['svgai.inner.guide.description'](),
      breadcrumb: m['svgai.marketing.nav_how'](),
      application: false,
    }),
  component: GuidePage,
});
