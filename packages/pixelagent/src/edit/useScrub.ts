import { useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

interface ScrubOptions {
  /** Read the current numeric value at drag start. */
  getValue: () => number | null;
  min?: number;
  max?: number;
  step?: number;
  onChange: (next: number) => void;
  /** Horizontal pixels of drag per one `step` increment. Lower = more sensitive. */
  pxPerStep?: number;
}

interface ScrubHandleProps {
  onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerCancel: (e: ReactPointerEvent<HTMLElement>) => void;
}

/**
 * Figma-style "drag to adjust value". Attach `handleProps` to a label/icon to
 * make it a horizontal scrubber. Uses pointer capture so the drag keeps tracking
 * even when the cursor leaves the element.
 */
export function useScrub({
  getValue,
  min = -Infinity,
  max = Infinity,
  step = 1,
  onChange,
  pxPerStep = 3,
}: ScrubOptions): { scrubbing: boolean; handleProps: ScrubHandleProps } {
  const [scrubbing, setScrubbing] = useState(false);
  const dragRef = useRef<{ startX: number; startValue: number } | null>(null);

  const onPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    const start = getValue();
    if (start === null || !Number.isFinite(start)) return;
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startValue: start };
    setScrubbing(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const deltaSteps = Math.round((e.clientX - drag.startX) / pxPerStep);
    if (deltaSteps === 0) return;
    const raw = drag.startValue + deltaSteps * step;
    // Snap to the step grid so float-based steps (e.g. opacity 0.01) stay clean.
    const snapped = Math.round(raw / step) * step;
    onChange(clamp(snapped, min, max));
  };

  const end = (e: ReactPointerEvent<HTMLElement>) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setScrubbing(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  return {
    scrubbing,
    handleProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: end,
      onPointerCancel: end,
    },
  };
}
