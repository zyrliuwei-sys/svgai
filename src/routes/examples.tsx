import { createFileRoute } from '@tanstack/react-router';

import { brandName } from '@/config/brand';
import { productPageHead } from '@/lib/seo';
import { m } from '@/paraglide/messages.js';
import { ExamplesPage } from '@/blocks/svg-inner-pages';

export const Route = createFileRoute('/examples')({
  head: () =>
    productPageHead({
      path: '/examples',
      title: m['svgai.inner.examples.title']({ brand: brandName }),
      description: m['svgai.inner.examples.description'](),
      breadcrumb: m['svgai.marketing.nav_examples'](),
      application: false,
    }),
  component: ExamplesPage,
});
