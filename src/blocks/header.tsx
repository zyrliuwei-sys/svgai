import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Menu, Moon, Sun, X } from 'lucide-react';
import { useTheme } from 'next-themes';

import { useSession } from '@/core/auth/client';
import { Link, usePathname } from '@/core/i18n/navigation';
import { envConfigs } from '@/config';
import { m } from '@/paraglide/messages.js';
import { useAppearance } from '@/hooks/use-appearance';
import { SiteUserMenu } from '@/components/site-user-menu';

import '@/styles/svg-marketing.css';

export function Header() {
  const { data: session, isPending } = useSession();
  const pathname = usePathname();
  const menuButton = useRef<HTMLButtonElement>(null);
  const { resolvedTheme, setTheme } = useTheme();
  const { colorModeForced } = useAppearance();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const dark = mounted && resolvedTheme === 'dark';
  const links = [
    { href: '/text-to-svg', label: m['svgai.marketing.nav_text']() },
    { href: '/image-to-svg', label: m['svgai.marketing.nav_image']() },
    { href: '/examples', label: m['svgai.marketing.nav_examples']() },
    { href: '/how-it-works', label: m['svgai.marketing.nav_how']() },
    { href: '/pricing', label: m['landing.nav.pricing']() },
  ];

  return (
    <header
      className="svgai-header"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && menuOpen) {
          setMenuOpen(false);
          menuButton.current?.focus();
        }
      }}
    >
      <a href="#main-content" className="svg-skip-link">
        {m['svgai.marketing.skip_content']()}
      </a>
      <div className="svgai-container svgai-header-inner">
        <Link
          href="/"
          className="svgai-brand"
          onClick={() => setMenuOpen(false)}
        >
          <img
            src={envConfigs.app_logo || '/logo.svg'}
            alt=""
            width={29}
            height={29}
          />
          <span>{envConfigs.app_name}</span>
        </Link>
        <nav
          className="svgai-desktop-nav"
          aria-label={m['svgai.marketing.main_navigation']()}
        >
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={pathname === link.href ? 'page' : undefined}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="svgai-header-actions">
          {!colorModeForced && (
            <button
              type="button"
              className="svgai-icon-button svgai-theme-button"
              aria-label={
                dark
                  ? m['svgai.marketing.theme_light']()
                  : m['svgai.marketing.theme_dark']()
              }
              onClick={() => setTheme(dark ? 'light' : 'dark')}
            >
              {dark ? <Sun size={17} /> : <Moon size={17} />}
            </button>
          )}
          {session?.user ? (
            <SiteUserMenu
              name={session.user.name}
              email={session.user.email}
              image={session.user.image}
            />
          ) : isPending ? (
            <span className="svgai-account-placeholder" aria-hidden="true">
              {m['svgai.marketing.sign_in']()}
            </span>
          ) : (
            <Link className="svgai-sign-in" href="/sign-in">
              {m['svgai.marketing.sign_in']()}
              <ArrowUpRight size={14} />
            </Link>
          )}
          <button
            type="button"
            className="svgai-icon-button svgai-menu-toggle"
            ref={menuButton}
            aria-label={
              menuOpen
                ? m['svgai.marketing.menu_close']()
                : m['svgai.marketing.menu_open']()
            }
            aria-expanded={menuOpen}
            aria-controls="svgai-mobile-nav"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X size={19} /> : <Menu size={19} />}
          </button>
        </div>
      </div>
      {menuOpen && (
        <nav
          id="svgai-mobile-nav"
          className="svgai-mobile-nav"
          aria-label={m['svgai.marketing.main_navigation']()}
        >
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={pathname === link.href ? 'page' : undefined}
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
              <ArrowUpRight size={14} />
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
