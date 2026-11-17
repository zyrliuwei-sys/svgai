import type { SvgSample } from '@/types/svg-generator';

import { SVG_SAMPLES, type SvgSampleId } from '@/lib/svg-samples';
import { m } from '@/paraglide/messages.js';

type SampleContent = Pick<SvgSample, 'name' | 'category' | 'prompt'> & {
  title: string;
};

/** Shared English content for the gallery and its interactive studio examples. */
export function getSvgSamples(): (SvgSample & { title: string })[] {
  const content: Record<SvgSampleId, SampleContent> = {
    botanical: {
      name: m['svgai.sample.botanical.name'](),
      title: m['svgai.marketing.sample_botanical'](),
      category: m['svgai.marketing.category_illustration'](),
      prompt: m['svgai.sample.botanical.prompt'](),
    },
    orbit: {
      name: m['svgai.sample.orbit.name'](),
      title: m['svgai.marketing.sample_orbit'](),
      category: m['svgai.marketing.category_abstract'](),
      prompt: m['svgai.sample.orbit.prompt'](),
    },
    landscape: {
      name: m['svgai.sample.landscape.name'](),
      title: m['svgai.marketing.sample_landscape'](),
      category: m['svgai.marketing.category_landscape'](),
      prompt: m['svgai.sample.landscape.prompt'](),
    },
    butterfly: {
      name: m['svgai.sample.butterfly.name'](),
      title: m['svgai.marketing.sample_butterfly'](),
      category: m['svgai.marketing.category_nature'](),
      prompt: m['svgai.sample.butterfly.prompt'](),
    },
    portrait: {
      name: m['svgai.sample.portrait.name'](),
      title: m['svgai.sample.portrait.title'](),
      category: m['svgai.sample.portrait.category'](),
      prompt: m['svgai.sample.portrait.prompt'](),
    },
    isometric: {
      name: m['svgai.sample.isometric.name'](),
      title: m['svgai.sample.isometric.title'](),
      category: m['svgai.sample.isometric.category'](),
      prompt: m['svgai.sample.isometric.prompt'](),
    },
    papercut: {
      name: m['svgai.sample.papercut.name'](),
      title: m['svgai.sample.papercut.title'](),
      category: m['svgai.sample.papercut.category'](),
      prompt: m['svgai.sample.papercut.prompt'](),
    },
    bauhaus: {
      name: m['svgai.sample.bauhaus.name'](),
      title: m['svgai.sample.bauhaus.title'](),
      category: m['svgai.sample.bauhaus.category'](),
      prompt: m['svgai.sample.bauhaus.prompt'](),
    },
    badge: {
      name: m['svgai.sample.badge.name'](),
      title: m['svgai.sample.badge.title'](),
      category: m['svgai.sample.badge.category'](),
      prompt: m['svgai.sample.badge.prompt'](),
    },
    fox: {
      name: m['svgai.sample.fox.name'](),
      title: m['svgai.sample.fox.title'](),
      category: m['svgai.sample.fox.category'](),
      prompt: m['svgai.sample.fox.prompt'](),
    },
    coffee: {
      name: m['svgai.sample.coffee.name'](),
      title: m['svgai.sample.coffee.title'](),
      category: m['svgai.sample.coffee.category'](),
      prompt: m['svgai.sample.coffee.prompt'](),
    },
    pixel: {
      name: m['svgai.sample.pixel.name'](),
      title: m['svgai.sample.pixel.title'](),
      category: m['svgai.sample.pixel.category'](),
      prompt: m['svgai.sample.pixel.prompt'](),
    },
    origami: {
      name: m['svgai.sample.origami.name'](),
      title: m['svgai.sample.origami.title'](),
      category: m['svgai.sample.origami.category'](),
      prompt: m['svgai.sample.origami.prompt'](),
    },
    deco: {
      name: m['svgai.sample.deco.name'](),
      title: m['svgai.sample.deco.title'](),
      category: m['svgai.sample.deco.category'](),
      prompt: m['svgai.sample.deco.prompt'](),
    },
    ribbon: {
      name: m['svgai.sample.ribbon.name'](),
      title: m['svgai.sample.ribbon.title'](),
      category: m['svgai.sample.ribbon.category'](),
      prompt: m['svgai.sample.ribbon.prompt'](),
    },
    koi: {
      name: m['svgai.sample.koi.name'](),
      title: m['svgai.sample.koi.title'](),
      category: m['svgai.sample.koi.category'](),
      prompt: m['svgai.sample.koi.prompt'](),
    },
  };
  return SVG_SAMPLES.map((sample) => ({ ...sample, ...content[sample.id] }));
}
