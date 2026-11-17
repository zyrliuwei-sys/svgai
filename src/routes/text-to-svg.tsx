import { createFileRoute } from '@tanstack/react-router';

import { productPageHead } from '@/lib/seo';
import { m } from '@/paraglide/messages.js';
import { TextToSvgPage } from '@/blocks/svg-inner-pages';

export const Route = createFileRoute('/text-to-svg')({
  head: () =>
    productPageHead({
      path: '/text-to-svg',
      title: m['svgai.inner.text.title'](),
      description: m['svgai.inner.text.description'](),
      breadcrumb: m['svgai.marketing.nav_text'](),
      application: true,
    }),
  component: TextToSvgPage,
});
