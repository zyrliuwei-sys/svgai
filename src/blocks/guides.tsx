import { useId, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, Eye } from 'lucide-react';

import { Link } from '@/core/i18n/navigation';
import { m } from '@/paraglide/messages.js';
import type { BlogPost } from '@/content/posts';

import '@/styles/svg-guides.css';

export function GuideShelf({
  guides,
  headingLevel,
}: {
  guides: BlogPost[];
  headingLevel: 2 | 3;
}) {
  const [selectedSlug, setSelectedSlug] = useState(guides[0]?.slug);
  const [showExample, setShowExample] = useState(false);
  const preview = useRef<HTMLElement>(null);
  const previewId = useId();
  const active =
    guides.find((guide) => guide.slug === selectedSlug) ?? guides[0];
  if (!active) return null;

  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  const cover = active.image
    ? { src: active.image, alt: active.title, ...active.imageDetails }
    : undefined;
  const example = active.guideExample;
  const showCoverAndExample = Boolean(cover && example);
  const image = (showExample ? example : cover) ?? cover ?? example;

  return (
    <div className="guide-shelf">
      <figure className="guide-preview" id={previewId} ref={preview}>
        <div className="guide-preview-art">
          {image ? (
            <img key={image.src} {...image} loading="lazy" decoding="async" />
          ) : (
            <p>{active.title}</p>
          )}
        </div>
        <figcaption className="guide-preview-toolbar">
          {showCoverAndExample && (
            <div
              className="guide-preview-switch"
              role="group"
              aria-label={m['guides.preview_label']()}
            >
              <button
                type="button"
                aria-pressed={!showExample}
                onClick={() => setShowExample(false)}
              >
                {m['guides.preview_cover']()}
              </button>
              <button
                type="button"
                aria-pressed={showExample}
                onClick={() => setShowExample(true)}
              >
                {m['guides.preview_example']()}
              </button>
            </div>
          )}
          <Link
            className="guide-preview-read"
            href={`/blog/${active.slug}`}
            aria-label={m['guides.read_named_guide']({ title: active.title })}
          >
            {m['guides.read_guide']()}
            <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
        </figcaption>
      </figure>
      <ul className="guide-shelf-list">
        {guides.map((guide) => (
          <li
            key={guide.slug}
            data-selected={guide.slug === active.slug}
            onPointerEnter={(event) => {
              if (event.pointerType === 'mouse') setSelectedSlug(guide.slug);
            }}
          >
            <button
              type="button"
              className="guide-shelf-thumbnail"
              aria-label={m['guides.preview_action']({ title: guide.title })}
              aria-controls={previewId}
              aria-pressed={guide.slug === active.slug}
              onClick={() => {
                setSelectedSlug(guide.slug);
                if (!window.matchMedia('(min-width: 56rem)').matches) {
                  preview.current?.scrollIntoView({ block: 'start' });
                }
              }}
            >
              {guide.image && (
                <img
                  src={guide.image}
                  alt=""
                  width={80}
                  height={54}
                  loading="lazy"
                  decoding="async"
                />
              )}
              <span className="guide-shelf-thumbnail-caption">
                <Eye size={14} aria-hidden="true" />
              </span>
            </button>
            <Link className="guide-shelf-link" href={`/blog/${guide.slug}`}>
              <div className="guide-shelf-copy">
                <Heading>{guide.title}</Heading>
                <p>{guide.description}</p>
              </div>
              <ArrowUpRight size={17} aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Guides({ guides }: { guides: BlogPost[] }) {
  if (!guides.length) return null;

  return (
    <section
      id="guides"
      aria-labelledby="home-guides-title"
      className="svgai-container border-border scroll-mt-24 border-t py-12 md:py-16"
    >
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div className="svgai-section-intro">
          <h2 id="home-guides-title">{m['guides.title']()}</h2>
          <p>{m['guides.description']()}</p>
        </div>
        <Link
          href="/guides"
          className="text-primary inline-flex items-center gap-2 text-sm font-medium underline-offset-4 hover:underline"
        >
          {m['guides.view_all']()}
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
      <GuideShelf guides={guides} headingLevel={3} />
    </section>
  );
}
