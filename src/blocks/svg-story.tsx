import {
  ArrowRight,
  ArrowUpRight,
  Braces,
  Layers3,
  PenTool,
  Shapes,
} from 'lucide-react';

import { Link } from '@/core/i18n/navigation';
import { m } from '@/paraglide/messages.js';
import { CurveStudy } from '@/components/curve-study';

export function SvgIntroduction() {
  return (
    <section className="svgai-container svg-story-intro">
      <div className="svg-story-heading">
        <span className="svg-story-kicker">{m['svgai.seo.intro_label']()}</span>
        <h2>{m['svgai.seo.intro_title']()}</h2>
        <div className="svg-story-links">
          <Link href="/text-to-svg">
            {m['svgai.seo.text_link']()}
            <ArrowUpRight size={15} />
          </Link>
          <Link href="/image-to-svg">
            {m['svgai.seo.image_link']()}
            <ArrowUpRight size={15} />
          </Link>
        </div>
      </div>
      <div className="svg-story-prose">
        <p>
          {m['svgai.seo.intro_one']()} {m['svgai.seo.text_context']()}{' '}
          <Link href="/text-to-svg">{m['svgai.marketing.nav_text']()}</Link>{' '}
          {m['svgai.seo.text_context_end']()}
        </p>
        <p>
          {m['svgai.seo.intro_two']()} {m['svgai.seo.image_context']()}{' '}
          <Link href="/image-to-svg">{m['svgai.marketing.nav_image']()}</Link>{' '}
          {m['svgai.seo.image_context_end']()}
        </p>
      </div>
    </section>
  );
}

export function SvgUseCases() {
  const items = [
    {
      Icon: Shapes,
      title: m['svgai.seo.uses_icons_title'](),
      text: m['svgai.seo.uses_icons_text'](),
    },
    {
      Icon: PenTool,
      title: m['svgai.seo.uses_brand_title'](),
      text: m['svgai.seo.uses_brand_text'](),
    },
    {
      Icon: Layers3,
      title: m['svgai.seo.uses_print_title'](),
      text: m['svgai.seo.uses_print_text'](),
    },
  ];
  return (
    <section className="svgai-container svg-uses">
      <h2>{m['svgai.seo.uses_title']()}</h2>
      <div className="svg-use-list">
        {items.map(({ Icon, title, text }, index) => (
          <article key={title}>
            <div className="svg-use-title">
              <Icon size={23} strokeWidth={1.4} />
              <h3>{title}</h3>
            </div>
            <p>
              {text}
              {index === 0 && (
                <>
                  {' '}
                  {m['svgai.seo.examples_context']()}{' '}
                  <Link href="/examples">
                    {m['svgai.marketing.nav_examples']()}
                  </Link>{' '}
                  {m['svgai.seo.examples_context_end']()}
                </>
              )}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function SvgCraft() {
  return (
    <section className="svgai-container svg-craft">
      <div className="svg-vector-detail">
        <CurveStudy
          copy={{
            title: m['svgai.curve.title'](),
            hint: m['svgai.curve.hint'](),
            reset: m['svgai.curve.reset'](),
            point: m['svgai.curve.point'](),
            position: (point, x, y) =>
              m['svgai.curve.position']({ point, x, y }),
          }}
        />
        <div>
          <h2>{m['svgai.seo.quality_title']()}</h2>
          <p>{m['svgai.seo.quality_text']()}</p>
        </div>
      </div>
      <div className="svg-prompt-guide">
        <div>
          <Braces size={24} strokeWidth={1.4} />
          <h2>{m['svgai.seo.prompt_title']()}</h2>
          <p>{m['svgai.seo.prompt_text']()}</p>
        </div>
        <blockquote>{m['svgai.seo.prompt_example']()}</blockquote>
      </div>
    </section>
  );
}

export function SvgClosing() {
  return (
    <section className="svgai-container svg-closing">
      <div>
        <h2>{m['svgai.seo.cta_title']()}</h2>
        <p>
          {m['svgai.seo.cta_text']()} {m['svgai.seo.pricing_context']()}{' '}
          <Link href="/pricing">{m['svgai.seo.pricing_link']()}</Link>{' '}
          {m['svgai.seo.pricing_context_end']()}
        </p>
      </div>
      <Link href="/#generator" className="svg-brand-button">
        {m['svgai.seo.cta_action']()}
        <ArrowRight size={18} />
      </Link>
    </section>
  );
}
