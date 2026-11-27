import { ArrowRight, ChevronRight } from 'lucide-react';

import { Link } from '@/core/i18n/navigation';
import { brandName } from '@/config/brand';
import { m } from '@/paraglide/messages.js';
import { Footer } from '@/blocks/footer';
import { Header } from '@/blocks/header';
import { Hero } from '@/blocks/hero';
import { SvgShowcase } from '@/blocks/svg-showcase';
import { SvgClosing } from '@/blocks/svg-story';

function Breadcrumb({ label }: { label: string }) {
  return (
    <nav
      className="svgai-container svg-breadcrumb"
      aria-label={m['svgai.inner.breadcrumb']()}
    >
      <Link href="/">{m['svgai.inner.home']()}</Link>
      <ChevronRight size={12} />
      <span aria-current="page">{label}</span>
    </nav>
  );
}

function ToolPage({ image = false }: { image?: boolean }) {
  return (
    <div className="svgai-page svg-inner-page">
      <Header />
      <main id="main-content" tabIndex={-1}>
        <Breadcrumb
          label={
            image
              ? m['svgai.marketing.nav_image']()
              : m['svgai.marketing.nav_text']()
          }
        />
        <Hero mode={image ? 'image' : 'text'} page={image ? 'image' : 'text'} />
        <section className="svgai-container svg-tool-explainer">
          <h2>
            {image
              ? m['svgai.inner.image.detail_title']()
              : m['svgai.inner.text.detail_title']()}
          </h2>
          <div>
            <p>
              {image
                ? m['svgai.inner.image.detail_text']()
                : m['svgai.inner.text.detail_text']({ brand: brandName })}
            </p>
            {!image && (
              <>
                <p className="svg-availability-note">
                  {m['svgai.inner.text.note']()}
                </p>
                <p>
                  <Link href="/blog/text-to-svg-icon-set">
                    {m['guides.icon_set_link']()}
                    <ArrowRight size={15} aria-hidden="true" />
                  </Link>
                </p>
              </>
            )}
            <Link href={image ? '/text-to-svg' : '/image-to-svg'}>
              {image ? m['svgai.seo.text_link']() : m['svgai.seo.image_link']()}
              <ArrowRight size={15} />
            </Link>
          </div>
        </section>
        <SvgShowcase />
        <SvgClosing />
      </main>
      <Footer />
    </div>
  );
}
export function TextToSvgPage() {
  return <ToolPage />;
}
export function ImageToSvgPage() {
  return <ToolPage image />;
}

export function ExamplesPage() {
  return (
    <div className="svgai-page svg-inner-page">
      <Header />
      <main id="main-content" tabIndex={-1}>
        <Breadcrumb label={m['svgai.marketing.nav_examples']()} />
        <SvgShowcase standalone />
        <p className="svgai-container svg-example-note">
          {m['svgai.inner.examples.note']()}
        </p>
        <SvgClosing />
      </main>
      <Footer />
    </div>
  );
}

export function GuidePage() {
  const chapters = [
    {
      id: 'start',
      title: m['svgai.inner.guide.start_title'](),
      text: m['svgai.inner.guide.start_text'](),
    },
    {
      id: 'refine',
      title: m['svgai.inner.guide.refine_title'](),
      text: m['svgai.inner.guide.refine_text'](),
    },
    {
      id: 'export',
      title: m['svgai.inner.guide.export_title'](),
      text: m['svgai.inner.guide.export_text'](),
    },
    {
      id: 'destination',
      title: m['svgai.inner.guide.finish_title'](),
      text: m['svgai.inner.guide.finish_text'](),
    },
  ];
  return (
    <div className="svgai-page svg-inner-page">
      <Header />
      <main id="main-content" tabIndex={-1}>
        <Breadcrumb label={m['svgai.marketing.nav_how']()} />
        <section className="svgai-container svg-inner-intro">
          <h1>
            {m['svgai.inner.guide.heading']()}{' '}
            <span>{m['svgai.inner.guide.emphasis']()}</span>
          </h1>
          <p>{m['svgai.inner.guide.subtitle']()}</p>
        </section>
        <div className="svgai-container svg-guide-layout">
          <nav aria-label={m['svgai.inner.guide.contents']()}>
            {chapters.map((x) => (
              <a href={`#${x.id}`} key={x.id}>
                {x.title}
                <ArrowRight size={12} />
              </a>
            ))}
          </nav>
          <div>
            {chapters.map((x) => (
              <section id={x.id} key={x.id}>
                <h2>{x.title}</h2>
                <p>{x.text}</p>
              </section>
            ))}
          </div>
        </div>
        <SvgClosing />
      </main>
      <Footer />
    </div>
  );
}
