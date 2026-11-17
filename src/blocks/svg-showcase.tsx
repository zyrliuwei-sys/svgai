import type { SvgSample } from '@/types/svg-generator';
import { ArrowUpRight } from 'lucide-react';

import { useRouter } from '@/core/i18n/navigation';
import { SVG_SAMPLES } from '@/lib/svg-samples';
import { outlineSvg, svgToDataUrl } from '@/lib/svg-vectorizer';
import { m } from '@/paraglide/messages.js';

export function SvgShowcase({ standalone = false }: { standalone?: boolean }) {
  const router = useRouter();
  const labels = {
    botanical: {
      name: m['svgai.marketing.sample_botanical'](),
      category: m['svgai.marketing.category_illustration'](),
    },
    orbit: {
      name: m['svgai.marketing.sample_orbit'](),
      category: m['svgai.marketing.category_abstract'](),
    },
    landscape: {
      name: m['svgai.marketing.sample_landscape'](),
      category: m['svgai.marketing.category_landscape'](),
    },
    butterfly: {
      name: m['svgai.marketing.sample_butterfly'](),
      category: m['svgai.marketing.category_nature'](),
    },
  };

  function loadSample(id: string) {
    if (standalone) {
      router.push(`/?sample=${encodeURIComponent(id)}#generator`);
      return;
    }
    window.dispatchEvent(
      new CustomEvent('svgai:load-sample', { detail: { id } })
    );
    document.getElementById('generator')?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'instant'
        : 'smooth',
      block: 'start',
    });
  }

  return (
    <section id="examples" className="svgai-container svgai-showcase">
      <div className="svgai-section-intro">
        <h2>{m['svgai.marketing.showcase_title']()}</h2>
        <p>{m['svgai.marketing.showcase_description']()}</p>
      </div>
      <div className="svgai-sample-grid">
        {SVG_SAMPLES.map((sample: SvgSample) => {
          const label = labels[sample.id as keyof typeof labels] || {
            name: sample.name,
            category: sample.category,
          };
          return (
            <button
              key={sample.id}
              type="button"
              className={`svgai-sample svgai-sample-${sample.id}`}
              onClick={() => loadSample(sample.id)}
              aria-label={`${m['svgai.marketing.sample_action']()}: ${label.name}`}
            >
              <span className="svgai-sample-art">
                <img
                  src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(sample.svg)}`}
                  alt={label.name}
                  width={512}
                  height={512}
                  loading="lazy"
                  className="svg-sample-fill"
                />
                <img
                  className="svg-sample-outline"
                  src={svgToDataUrl(outlineSvg(sample.svg))}
                  alt=""
                  width={512}
                  height={512}
                  loading="lazy"
                  aria-hidden="true"
                />
              </span>
              <span className="svgai-sample-caption">
                <span>
                  <strong>{label.name}</strong>
                  <span>{label.category}</span>
                </span>
                <ArrowUpRight size={17} />
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
