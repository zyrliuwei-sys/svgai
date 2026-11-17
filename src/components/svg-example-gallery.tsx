import { useId, useMemo, useState } from 'react';
import type { SvgSample, SvgStyle } from '@/types/svg-generator';
import { ArrowUpRight, ChevronsLeftRight } from 'lucide-react';

import { getSvgStats, outlineSvg, svgToDataUrl } from '@/lib/svg-vectorizer';
import {
  SvgComparison,
  type SvgComparisonCopy,
} from '@/components/svg-comparison';

import '@/styles/svg-example-gallery.css';

type GalleryFilter = 'all' | SvgStyle;
type GallerySample = SvgSample & { title: string };

export interface SvgExampleGalleryCopy {
  title: string;
  description: string;
  filterLabel: string;
  filters: { id: GalleryFilter; label: string }[];
  comparison: SvgComparisonCopy;
  openExample: (title: string) => string;
  results: (count: number) => string;
}

export function SvgExampleGallery({
  samples,
  copy,
  onSelect,
  standalone = false,
}: {
  samples: GallerySample[];
  copy: SvgExampleGalleryCopy;
  onSelect: (id: string) => void;
  standalone?: boolean;
}) {
  const titleId = useId();
  const gridId = useId();
  const [filter, setFilter] = useState<GalleryFilter>('all');
  const artwork = useMemo(
    () =>
      samples.map((sample) => ({
        ...sample,
        dimensions: getSvgStats(sample.svg),
        colorUrl: svgToDataUrl(sample.svg),
        outlineUrl: svgToDataUrl(outlineSvg(sample.svg)),
      })),
    [samples]
  );
  const visible = artwork.filter(
    (sample) => filter === 'all' || sample.style === filter
  );
  const Heading = standalone ? 'h1' : 'h2';

  return (
    <section
      id="examples"
      aria-labelledby={titleId}
      className="svgai-container svg-library"
    >
      <header className="svg-library-header">
        <Heading id={titleId} className="svg-library-title">
          {copy.title}
        </Heading>
        <p>{copy.description}</p>
      </header>
      <div className="svg-library-toolbar">
        <div
          className="svg-library-filters"
          role="group"
          aria-label={copy.filterLabel}
        >
          {copy.filters.map((item) => {
            const count =
              item.id === 'all'
                ? artwork.length
                : artwork.filter((sample) => sample.style === item.id).length;
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={filter === item.id}
                aria-controls={gridId}
                onClick={() => setFilter(item.id)}
                className="svg-library-filter"
              >
                {item.label}
                <span aria-hidden="true">{count}</span>
              </button>
            );
          })}
        </div>
        <p className="svg-library-compare-hint">
          <ChevronsLeftRight size={16} aria-hidden="true" />
          {copy.comparison.hint}
        </p>
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        {copy.results(visible.length)}
      </p>
      <div id={gridId} className="svg-library-grid">
        {visible.map((sample) => (
          <article key={sample.id} className="svg-library-item">
            <div className="svg-library-canvas">
              <SvgComparison
                colorSrc={sample.colorUrl}
                outlineSrc={sample.outlineUrl}
                alt={sample.title}
                width={sample.dimensions.width}
                height={sample.dimensions.height}
                copy={copy.comparison}
                scale={1.16}
                loading="lazy"
              />
            </div>
            <button
              type="button"
              className="svg-library-caption"
              aria-label={copy.openExample(sample.title)}
              onClick={() => onSelect(sample.id)}
            >
              <span>
                <strong>{sample.title}</strong>
                <span>{sample.category}</span>
              </span>
              <span className="svg-library-open" aria-hidden="true">
                <ArrowUpRight size={16} strokeWidth={1.6} />
              </span>
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
