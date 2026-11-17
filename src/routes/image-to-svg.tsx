import { createFileRoute } from '@tanstack/react-router';

import { brandName } from '@/config/brand';
import { productPageHead } from '@/lib/seo';
import { m } from '@/paraglide/messages.js';
import { ImageToSvgPage } from '@/blocks/svg-inner-pages';

export const Route = createFileRoute('/image-to-svg')({
  head: () =>
    productPageHead({
      path: '/image-to-svg',
      title: m['svgai.inner.image.title']({ brand: brandName }),
      description: m['svgai.inner.image.description'](),
      breadcrumb: m['svgai.marketing.nav_image'](),
      application: true,
    }),
  component: ImageToSvgPage,
});
