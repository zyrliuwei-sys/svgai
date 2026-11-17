import { createFileRoute } from '@tanstack/react-router';

import { brandName } from '@/config/brand';
import { productPageHead } from '@/lib/seo';
import { m } from '@/paraglide/messages.js';
import { FAQ } from '@/blocks/faq';
import { Footer } from '@/blocks/footer';
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

function HomePage() {
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
      </main>
      <Footer />
    </div>
  );
}

export const Route = createFileRoute('/')({
  head: () =>
    productPageHead({
      path: '/',
      title: m['svgai.metadata.title']({ brand: brandName }),
      description: m['svgai.metadata.description'](),
      application: true,
    }),
  component: HomePage,
});
