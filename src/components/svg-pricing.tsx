import { useEffect, useState } from 'react';
import {
  ArrowRight,
  Check,
  Loader2,
  RefreshCw,
  Sparkles,
  Wallet,
} from 'lucide-react';

export interface SvgPricingPlan {
  id: string;
  name: string;
  description: string;
  price: string;
  credits: string;
  estimate: string;
  comparison?: string;
  savings?: string;
  featured?: boolean;
}
export interface SvgPricingGroup {
  id: string;
  label: string;
  note: string;
  interval: string;
  cta: string;
  plans: SvgPricingPlan[];
}
export interface SvgPricingCopy {
  eyebrow: string;
  title: string;
  description: string;
  popular: string;
  credits: string;
  perCredit: string;
  features: string[];
  billingNote: string;
  billingTitle: string;
  billingDescription: string;
  reserve: string;
  refund: string;
  processing: string;
  faqTitle: string;
  faqs: { question: string; answer: string }[];
}

/** Content and checkout arrive from the block; this surface shares the studio's visual system. */
export function SvgPricing({
  groups,
  copy,
  onCheckout,
  loadingId,
  headingLevel = 1,
  initialGroup = groups[0].id,
}: {
  groups: SvgPricingGroup[];
  copy: SvgPricingCopy;
  onCheckout: (id: string) => void;
  loadingId?: string | null;
  headingLevel?: 1 | 2;
  initialGroup?: string;
}) {
  const Heading = headingLevel === 1 ? 'h1' : 'h2';
  const Subheading = headingLevel === 1 ? 'h2' : 'h3';
  const [active, setActive] = useState(initialGroup);
  useEffect(() => setActive(initialGroup), [initialGroup]);
  const group = groups.find((g) => g.id === active)!;
  return (
    <section className="svg-pricing svgai-container" id="pricing">
      <div className="svg-pricing-heading">
        <span className="svg-pricing-eyebrow">
          <Sparkles size={13} />
          {copy.eyebrow}
        </span>
        <Heading>{copy.title}</Heading>
        <p>{copy.description}</p>
      </div>
      <div
        className="svg-pricing-toggle"
        role="group"
        aria-label={copy.billingTitle}
      >
        {groups.map((g) => (
          <button
            type="button"
            key={g.id}
            aria-pressed={active === g.id}
            className={active === g.id ? 'is-active' : ''}
            onClick={() => setActive(g.id)}
          >
            {g.id === 'once' ? <Wallet size={15} /> : <RefreshCw size={14} />}{' '}
            {g.label}
          </button>
        ))}
      </div>
      <p className="svg-pricing-group-note">{group.note}</p>
      <div className="svg-pricing-grid">
        {group.plans.map((plan, index) => (
          <article
            key={plan.id}
            className={`svg-price-card ${plan.featured ? 'is-featured' : ''}`}
          >
            <div className="svg-price-card-top">
              <span className="svg-price-index">0{index + 1}</span>
              {plan.featured && (
                <span className="svg-price-badge">{copy.popular}</span>
              )}
            </div>
            <Subheading>{plan.name}</Subheading>
            <p className="svg-price-description">{plan.description}</p>
            <div className="svg-price-amount">
              <strong>{plan.price}</strong>
              <span>{group.interval}</span>
            </div>
            {plan.savings && (
              <p className="svg-price-saving">
                <s>{plan.comparison}</s>
                <span>{plan.savings}</span>
              </p>
            )}
            <div className="svg-price-credits">
              <Sparkles size={16} />
              <strong>{plan.credits}</strong>
              <span>{copy.credits}</span>
            </div>
            <p className="svg-price-estimate">{plan.estimate}</p>
            <button
              type="button"
              className="svg-price-cta"
              disabled={Boolean(loadingId)}
              onClick={() => onCheckout(plan.id)}
            >
              {loadingId === plan.id ? (
                <>
                  <Loader2 size={15} className="svg-spin" />
                  {copy.processing}
                </>
              ) : (
                <>
                  {group.cta}
                  <ArrowRight size={16} />
                </>
              )}
            </button>
            <ul>
              {copy.features.map((feature) => (
                <li key={feature}>
                  <Check size={14} />
                  {feature}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
      <p className="svg-pricing-footnote">
        {copy.perCredit} · {copy.billingNote}
      </p>
      <div className="svg-pricing-billing">
        <div>
          <span className="svg-pricing-eyebrow">{copy.billingTitle}</span>
          <Subheading>{copy.billingDescription}</Subheading>
        </div>
        <div>
          <p>
            <Wallet size={18} />
            {copy.reserve}
          </p>
          <p>
            <RefreshCw size={18} />
            {copy.refund}
          </p>
        </div>
      </div>
      <div className="svg-pricing-faq">
        <Subheading>{copy.faqTitle}</Subheading>
        <div>
          {copy.faqs.map((faq) => (
            <details key={faq.question}>
              <summary>
                {faq.question}
                <span>+</span>
              </summary>
              <p>{faq.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
