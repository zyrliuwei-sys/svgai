import { ArrowLeft } from 'lucide-react';

import { Link } from '@/core/i18n/navigation';
import { envConfigs } from '@/config';
import { SVG_SAMPLES } from '@/lib/svg-samples';
import { svgToDataUrl } from '@/lib/svg-vectorizer';
import { m } from '@/paraglide/messages.js';

export function AuthBrand() {
  return (
    <aside className="svg-auth-brand">
      <Link href="/" className="svgai-brand">
        <img src="/logo.svg" width={32} height={32} alt="" />
        <span>{envConfigs.app_name}</span>
      </Link>
      <div>
        <h2>{m['svgai.auth.title']()}</h2>
        <p>{m['svgai.auth.description']()}</p>
      </div>
      <img
        className="svg-auth-art"
        src={svgToDataUrl(SVG_SAMPLES[1]!.svg)}
        alt=""
        width={512}
        height={512}
      />
      <Link className="svg-auth-back" href="/">
        <ArrowLeft size={15} />
        {m['svgai.auth.back']()}
      </Link>
    </aside>
  );
}
