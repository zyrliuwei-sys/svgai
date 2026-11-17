import { Link } from '@/core/i18n/navigation';
import { m } from '@/paraglide/messages.js';

export function AuthHelp() {
  return (
    <div className="text-muted-foreground space-y-2 px-2 text-center text-xs leading-relaxed">
      <p>
        {m['svgai.auth.policies_prefix']()}{' '}
        <Link
          href="/terms-of-service"
          className="hover:text-foreground underline underline-offset-4"
        >
          {m['landing.footer.terms']()}
        </Link>{' '}
        {m['svgai.auth.policies_between']()}{' '}
        <Link
          href="/privacy-policy"
          className="hover:text-foreground underline underline-offset-4"
        >
          {m['landing.footer.privacy']()}
        </Link>
        .
      </p>
      <a
        href={`mailto:${m['svgai.support.email']()}`}
        className="hover:text-foreground underline underline-offset-4"
      >
        {m['svgai.support.email']()}
      </a>
    </div>
  );
}
