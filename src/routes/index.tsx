import { createFileRoute } from '@tanstack/react-router';

import { brandName } from '@/config/brand';
import { productPageHead } from '@/lib/seo';
import { m } from '@/paraglide/messages.js';
import { getLocale } from '@/paraglide/runtime.js';
import { FAQ } from '@/blocks/faq';
import { Footer } from '@/blocks/footer';
import { Guides } from '@/blocks/guides';
import { Header } from '@/blocks/header';
import { Hero } from '@/blocks/hero';
import { Pricing } from '@/blocks/pricing';
import { SvgShowcase } from '@/blocks/svg-showcase';
import {
  SvgClosing,
  SvgCraft,
  SvgIntroduction,
  SvgUseCases,
} from '@/blocks/svg-story';
import { SvgWorkflow } from '@/blocks/svg-workflow';
import { getGuidesFn } from '@/content/posts/server';

function HomePage() {
  const guides = Route.useLoaderData();

  return (
    <div className="svgai-page">
      <Header />
      <main id="main-content" tabIndex={-1}>
        <Hero />
        <SvgIntroduction />
        <SvgShowcase />
        <SvgWorkflow />
        <SvgUseCases />
        <SvgCraft />
        <Pricing headingLevel={2} />
        <FAQ />
        <SvgClosing />
        <Guides guides={guides} />
      </main>
      <Footer />
    </div>
  );
}

export const Route = createFileRoute('/')({
  loader: () => getGuidesFn({ data: { locale: getLocale(), limit: 3 } }),
  head: () =>
    productPageHead({
      path: '/',
      title: m['svgai.metadata.title']({ brand: brandName }),
      description: m['svgai.metadata.description'](),
      application: true,
    }),
  component: HomePage,
});
