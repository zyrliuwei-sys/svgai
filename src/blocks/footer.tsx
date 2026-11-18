import { ArrowUpRight } from 'lucide-react';

import { Link } from '@/core/i18n/navigation';
import { envConfigs } from '@/config';
import { m } from '@/paraglide/messages.js';
import { FooterBadgeList } from '@/components/footer-badge-list';

export function Footer() {
  return (
    <footer className="svgai-footer">
      <div className="svgai-container">
        <div className="svgai-footer-top">
          <div className="svgai-footer-brand">
            <Link className="svgai-brand" href="/">
              <img
                src={envConfigs.app_logo || '/logo.svg'}
                alt=""
                width={29}
                height={29}
                loading="lazy"
              />
              <span>{envConfigs.app_name}</span>
            </Link>
            <p>{m['svgai.marketing.footer_tagline']()}</p>
            <div className="svgai-producthunt-card">
              <div className="svgai-producthunt-summary">
                <img
                  src="https://ph-files.imgix.net/163592ac-d154-45c8-aa5c-408d75a01fa4.png?auto=compress,format&codec=mozjpeg&cs=strip&fit=crop&h=80&w=80"
                  alt={envConfigs.app_name}
                  width={64}
                  height={64}
                  loading="lazy"
                />
                <div>
                  <h3>{envConfigs.app_name}</h3>
                  <p>{m['svgai.marketing.producthunt_tagline']()}</p>
                </div>
              </div>
              <a
                href="https://www.producthunt.com/products/vectormint?embed=true&utm_source=embed&utm_medium=post_embed"
                target="_blank"
                rel="noopener noreferrer"
              >
                {m['svgai.marketing.producthunt_cta']()}
              </a>
            </div>
          </div>
          <div className="svgai-footer-links">
            <h3>{m['svgai.marketing.footer_product']()}</h3>
            <Link href="/text-to-svg">
              {m['svgai.marketing.nav_text']()}
              <ArrowUpRight size={12} />
            </Link>
            <Link href="/image-to-svg">
              {m['svgai.marketing.nav_image']()}
              <ArrowUpRight size={12} />
            </Link>
            <Link href="/examples">
              {m['svgai.marketing.nav_examples']()}
              <ArrowUpRight size={12} />
            </Link>
            <Link href="/how-it-works">
              {m['svgai.marketing.nav_how']()}
              <ArrowUpRight size={12} />
            </Link>
          </div>
          <div className="svgai-footer-links">
            <h3>{m['svgai.marketing.footer_information']()}</h3>
            <Link href="/#faq">
              {m['svgai.marketing.nav_faq']()}
              <ArrowUpRight size={12} />
            </Link>
            <Link href="/pricing">
              {m['landing.nav.pricing']()}
              <ArrowUpRight size={12} />
            </Link>
            <Link href="/privacy-policy">
              {m['svgai.marketing.footer_privacy']()}
              <ArrowUpRight size={12} />
            </Link>
            <Link href="/terms-of-service">
              {m['svgai.marketing.footer_terms']()}
              <ArrowUpRight size={12} />
            </Link>
            <a
              href={`mailto:${m['svgai.support.email']()}`}
              aria-label={m['svgai.support.label']()}
            >
              {m['svgai.support.email']()}
              <ArrowUpRight size={12} />
            </a>
          </div>
        </div>
        <FooterBadgeList className="mb-7" />
        <div className="svgai-footer-bottom">
          <p>
            © {new Date().getFullYear()} {envConfigs.app_name}.{' '}
            {m['svgai.marketing.footer_copyright']()}
          </p>
          <p>{m['svgai.marketing.footer_note']()}</p>
        </div>
      </div>
    </footer>
  );
}
