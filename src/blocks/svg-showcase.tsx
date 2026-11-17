import { useRouter } from '@/core/i18n/navigation';
import { m } from '@/paraglide/messages.js';
import { getSvgSamples } from '@/blocks/svg-sample-content';
import { SvgExampleGallery } from '@/components/svg-example-gallery';

export function SvgShowcase({ standalone = false }: { standalone?: boolean }) {
  const router = useRouter();
  const samples = getSvgSamples();

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
    <SvgExampleGallery
      samples={samples}
      onSelect={loadSample}
      standalone={standalone}
      copy={{
        title: m['svgai.marketing.showcase_title'](),
        description: m['svgai.marketing.showcase_description']({
          count: samples.length,
        }),
        filterLabel: m['svgai.gallery.filter_label'](),
        filters: [
          { id: 'all', label: m['svgai.gallery.all']() },
          { id: 'illustration', label: m['svgai.gallery.illustrations']() },
          { id: 'logo', label: m['svgai.gallery.logos']() },
          { id: 'icon', label: m['svgai.gallery.icons']() },
          { id: 'line-art', label: m['svgai.gallery.line_art']() },
        ],
        comparison: {
          color: m['svgai.gallery.color'](),
          outline: m['svgai.gallery.outline'](),
          hint: m['svgai.compare.hint'](),
          label: (title) => m['svgai.compare.label']({ title }),
          valueText: (percent) =>
            m['svgai.compare.value']({
              color: percent,
              outline: 100 - percent,
            }),
        },
        openExample: (title) =>
          `${m['svgai.marketing.sample_action']()}: ${title}`,
        results: (count) => m['svgai.gallery.results']({ count }),
      }}
    />
  );
}
