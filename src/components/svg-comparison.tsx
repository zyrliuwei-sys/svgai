import { useId, useState, type CSSProperties } from 'react';
import { ChevronsLeftRight } from 'lucide-react';

import { cn } from '@/lib/utils';

import '@/styles/svg-comparison.css';

export interface SvgComparisonCopy {
  color: string;
  outline: string;
  hint: string;
  label: (title: string) => string;
  valueText: (percent: number) => string;
}

/** Two aligned image layers, controlled by a native pointer/touch/keyboard slider. */
export function SvgComparison({
  colorSrc,
  outlineSrc,
  alt,
  width,
  height,
  copy,
  className,
  value,
  onValueChange,
  scale = 1,
  disabled = false,
  loading = 'eager',
  priority = false,
}: {
  colorSrc: string;
  outlineSrc: string;
  alt: string;
  width: number;
  height: number;
  copy: SvgComparisonCopy;
  className?: string;
  value?: number;
  onValueChange?: (value: number) => void;
  scale?: number;
  disabled?: boolean;
  loading?: 'eager' | 'lazy';
  priority?: boolean;
}) {
  const hintId = useId();
  const [position, setPosition] = useState(50);
  const percent = Math.max(0, Math.min(100, value ?? position));

  return (
    <div
      className={cn('svg-comparison', className)}
      style={
        {
          '--comparison-position': `${percent}%`,
          '--comparison-scale': scale,
        } as CSSProperties
      }
    >
      <div className="svg-comparison-layer">
        <img
          className="svg-comparison-image svg-comparison-outline"
          src={outlineSrc}
          width={width}
          height={height}
          alt=""
          draggable={false}
          loading={loading}
          fetchPriority={priority ? 'high' : undefined}
          decoding="async"
        />
      </div>
      <div className="svg-comparison-layer svg-comparison-color">
        <img
          className="svg-comparison-image"
          src={colorSrc}
          width={width}
          height={height}
          alt=""
          draggable={false}
          loading={loading}
          fetchPriority={priority ? 'high' : undefined}
          decoding="async"
        />
      </div>
      <span
        className="svg-comparison-label svg-comparison-label-color"
        aria-hidden="true"
        style={{ opacity: percent > 12 ? 1 : 0 }}
      >
        {copy.color}
      </span>
      <span
        className="svg-comparison-label svg-comparison-label-outline"
        aria-hidden="true"
        style={{ opacity: percent < 88 ? 1 : 0 }}
      >
        {copy.outline}
      </span>
      <span className="svg-comparison-divider" aria-hidden="true">
        <span className="svg-comparison-handle">
          <ChevronsLeftRight size={18} strokeWidth={1.8} />
        </span>
      </span>
      <span id={hintId} className="sr-only">
        {copy.hint}
      </span>
      <input
        className="svg-comparison-range"
        type="range"
        min={0}
        max={100}
        step={1}
        value={percent}
        disabled={disabled}
        aria-label={copy.label(alt)}
        aria-valuetext={copy.valueText(percent)}
        aria-describedby={hintId}
        onChange={(event) => {
          const next = Number(event.target.value);
          setPosition(next);
          onValueChange?.(next);
        }}
      />
    </div>
  );
}
