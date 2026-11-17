import type { SvgSample } from '@/types/svg-generator';
import {
  ArrowRight,
  Download,
  ImagePlus,
  MousePointer2,
  ShieldCheck,
} from 'lucide-react';

import { SVG_SAMPLES } from '@/lib/svg-samples';
import { m } from '@/paraglide/messages.js';

export function SvgWorkflow() {
  const steps = [
    {
      icon: ImagePlus,
      title: m['svgai.marketing.step_describe'](),
      description: m['svgai.marketing.step_describe_text'](),
    },
    {
      icon: MousePointer2,
      title: m['svgai.marketing.step_refine'](),
      description: m['svgai.marketing.step_refine_text'](),
    },
    {
      icon: Download,
      title: m['svgai.marketing.step_download'](),
      description: m['svgai.marketing.step_download_text'](),
    },
  ];
  const artwork =
    SVG_SAMPLES.find((sample: SvgSample) => sample.id === 'orbit') ||
    SVG_SAMPLES[0];
  return (
    <section
      id="how-it-works"
      className="svgai-container svgai-workflow-section"
    >
      <div className="svgai-section-intro">
        <h2>{m['svgai.marketing.workflow_title']()}</h2>
      </div>
      <ol className="svgai-workflow">
        {steps.map(({ icon: Icon, title, description }, index) => (
          <li key={title}>
            <span className="svgai-step-icon">
              <Icon size={21} strokeWidth={1.4} />
            </span>
            <div>
              <h3>{title}</h3>
              <p>{description}</p>
            </div>
            {index < steps.length - 1 && (
              <ArrowRight
                className="svgai-step-arrow"
                size={21}
                strokeWidth={1.1}
                aria-hidden="true"
              />
            )}
          </li>
        ))}
      </ol>
      <div className="svgai-benefit-grid">
        <article className="svgai-benefit svgai-benefit-paths">
          <div className="svgai-benefit-copy">
            <h3>{m['svgai.marketing.benefit_paths_title']()}</h3>
            <p>{m['svgai.marketing.benefit_paths_description']()}</p>
          </div>
          <figure className="svgai-benefit-art">
            {artwork && (
              <img
                src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(artwork.svg)}`}
                alt={m['svgai.marketing.benefit_paths_caption']()}
                width={512}
                height={512}
                loading="lazy"
              />
            )}
            <figcaption>
              {m['svgai.marketing.benefit_paths_caption']()}
            </figcaption>
          </figure>
        </article>
        <article className="svgai-benefit svgai-benefit-privacy">
          <ShieldCheck
            className="svgai-privacy-icon"
            size={36}
            strokeWidth={1.2}
            aria-hidden="true"
          />
          <div className="svgai-benefit-copy">
            <h3>{m['svgai.marketing.benefit_privacy_title']()}</h3>
            <p>{m['svgai.marketing.benefit_privacy_description']()}</p>
          </div>
          <p className="svgai-privacy-note">
            <span aria-hidden="true">↳</span>
            {m['svgai.marketing.benefit_privacy_caption']()}
          </p>
        </article>
      </div>
    </section>
  );
}
