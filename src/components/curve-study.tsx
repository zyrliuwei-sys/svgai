import {
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import { RotateCcw } from 'lucide-react';

type Point = { x: number; y: number };
const defaults: [Point, Point] = [
  { x: 92, y: 24 },
  { x: 308, y: 216 },
];
const bounded = (x: number, y: number): Point => ({
  x: Math.round(Math.max(22, Math.min(378, x)) * 10) / 10,
  y: Math.round(Math.max(20, Math.min(220, y)) * 10) / 10,
});
interface Copy {
  title: string;
  hint: string;
  reset: string;
  point: string;
  position: (point: number, x: number, y: number) => string;
}

/** A cubic Bézier study with pointer and keyboard controls. */
export function CurveStudy({ copy }: { copy: Copy }) {
  const id = useId();
  const svgRef = useRef<SVGSVGElement>(null);
  const [points, setPoints] = useState<[Point, Point]>(defaults);
  const [dragging, setDragging] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const path = `M 48 175 C ${points[0].x} ${points[0].y} ${points[1].x} ${points[1].y} 352 65`;
  const update = (index: number, point: Point) =>
    setPoints(
      (previous) =>
        previous.map((p, i) => (i === index ? point : p)) as [Point, Point]
    );
  function move(event: PointerEvent<SVGGElement>, index: number) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const matrix = svgRef.current?.getScreenCTM();
    if (!matrix) return;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(
      matrix.inverse()
    );
    update(index, bounded(point.x, point.y));
  }
  function key(event: KeyboardEvent<SVGGElement>, index: number) {
    const step = event.shiftKey ? 10 : 2;
    const point = points[index]!;
    const delta: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const direction = delta[event.key];
    if (!direction && event.key !== 'Home') return;
    event.preventDefault();
    const next =
      event.key === 'Home'
        ? defaults[index]!
        : bounded(point.x + direction![0], point.y + direction![1]);
    update(index, next);
    setAnnouncement(copy.position(index + 1, next.x, next.y));
  }
  return (
    <div
      className={`svg-curve-study ${dragging !== null ? 'is-dragging' : ''}`}
    >
      <div className="svg-curve-caption">
        <span>{copy.title}</span>
        <div>
          <button
            type="button"
            onClick={() => {
              setPoints(defaults);
              setAnnouncement('');
            }}
            aria-label={copy.reset}
            title={copy.reset}
          >
            <RotateCcw size={14} />
          </button>
        </div>
      </div>
      <svg
        ref={svgRef}
        viewBox="0 0 400 240"
        className="svg-curve-canvas"
        aria-label={copy.title}
      >
        <path
          className="svg-curve-ghost"
          d="M 48 175 C 92 24 308 216 352 65"
          fill="none"
        />
        <path
          className="svg-curve-tangents"
          d={`M 48 175 L ${points[0].x} ${points[0].y} M 352 65 L ${points[1].x} ${points[1].y}`}
          fill="none"
        />
        <path className="svg-curve-path" d={path} fill="none" />
        <rect
          className="svg-curve-anchor"
          x="43"
          y="170"
          width="10"
          height="10"
        />
        <rect
          className="svg-curve-anchor"
          x="347"
          y="60"
          width="10"
          height="10"
        />
        {points.map((point, index) => (
          <g
            key={index}
            className="svg-curve-handle"
            transform={`translate(${point.x} ${point.y})`}
            role="button"
            tabIndex={0}
            aria-label={`${copy.point} ${index + 1}`}
            aria-describedby={`${id}-hint`}
            onKeyDown={(event) => key(event, index)}
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              event.preventDefault();
              event.currentTarget.focus();
              event.currentTarget.setPointerCapture(event.pointerId);
              setDragging(index);
            }}
            onPointerMove={(event) => move(event, index)}
            onPointerUp={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId))
                event.currentTarget.releasePointerCapture(event.pointerId);
              setDragging(null);
              setAnnouncement(copy.position(index + 1, point.x, point.y));
            }}
            onPointerCancel={() => setDragging(null)}
            onLostPointerCapture={() => setDragging(null)}
          >
            <circle className="svg-curve-hit" r="20" />
            <circle className="svg-curve-point" r="7" />
          </g>
        ))}
      </svg>
      <p id={`${id}-hint`} className="svg-curve-hint">
        {copy.hint}
      </p>
      <span className="sr-only" role="status">
        {announcement}
      </span>
    </div>
  );
}
