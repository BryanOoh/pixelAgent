import { useEffect, useState } from 'react';
import type { AnnotationEntry } from '@pixelagent/shared';
import { getAnnotationSessionDisplay, resolveElementFromEntry } from '@pixelagent/shared';
import {
  anchorRectKey,
  getAnnotationAnchorRect,
} from './annotationAnchor';

export interface AnnotationBadgePin {
  id: string;
  index: number;
  top: number;
  left: number;
  note: string;
  target: string;
  rect: { top: number; left: number; width: number; height: number };
}

interface AnnotationBadgesOverlayProps {
  annotations: AnnotationEntry[];
  activeId: string | null;
  onActiveChange: (id: string | null) => void;
}

const STACK_OFFSET_PX = 20;

/** Below this viewport-top the preview flips under the element to stay on-screen. */
const PREVIEW_FLIP_THRESHOLD_PX = 96;

export function AnnotationBadgesOverlay({
  annotations,
  activeId,
  onActiveChange,
}: AnnotationBadgesOverlayProps) {
  const [pins, setPins] = useState<AnnotationBadgePin[]>([]);

  useEffect(() => {
    if (annotations.length === 0) {
      setPins([]);
      return;
    }

    const update = () => {
      const next: AnnotationBadgePin[] = [];
      const stackAtKey = new Map<string, number>();

      annotations.forEach((entry, i) => {
        const rect = getAnnotationAnchorRect(entry);
        if (!rect) return;

        const key = anchorRectKey(rect);
        const stack = stackAtKey.get(key) ?? 0;
        stackAtKey.set(key, stack + 1);

        next.push({
          id: entry.id,
          index: i + 1,
          top: rect.top + 6 - stack * STACK_OFFSET_PX,
          left: rect.right - 6,
          note: entry.note,
          target: getAnnotationSessionDisplay(entry).target,
          rect: {
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
          },
        });
      });

      setPins(next);
    };

    update();

    const observed = new Set<Element>();
    for (const entry of annotations) {
      const el = resolveElementFromEntry(entry);
      if (el) observed.add(el);
    }

    const observers = Array.from(observed).map((el) => {
      const observer = new ResizeObserver(update);
      observer.observe(el);
      return observer;
    });

    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);

    return () => {
      for (const observer of observers) observer.disconnect();
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [annotations]);

  if (pins.length === 0) return null;

  const activePin = activeId ? pins.find((p) => p.id === activeId) ?? null : null;
  const previewBelow = activePin
    ? activePin.rect.top < PREVIEW_FLIP_THRESHOLD_PX
    : false;

  return (
    <>
      {activePin && (
        <div
          className="pa-highlight pa-highlight-selected"
          style={{
            top: activePin.rect.top,
            left: activePin.rect.left,
            width: activePin.rect.width,
            height: activePin.rect.height,
          }}
        />
      )}

      {pins.map((pin) => (
        <button
          key={pin.id}
          type="button"
          className={
            pin.id === activeId
              ? 'pa-annotation-badge pa-annotation-badge--active'
              : 'pa-annotation-badge'
          }
          style={{ top: pin.top, left: pin.left }}
          aria-label={`Annotation ${pin.index}: ${pin.note}`}
          onMouseEnter={() => onActiveChange(pin.id)}
          onMouseLeave={() => onActiveChange(null)}
          onFocus={() => onActiveChange(pin.id)}
          onBlur={() => onActiveChange(null)}
        >
          {pin.index}
        </button>
      ))}

      {activePin && (
        <div
          className={
            previewBelow
              ? 'pa-annotation-preview pa-annotation-preview--below'
              : 'pa-annotation-preview'
          }
          style={{
            top: previewBelow
              ? activePin.rect.top + activePin.rect.height + 8
              : activePin.rect.top - 8,
            left: activePin.rect.left,
          }}
          aria-hidden="true"
        >
          <span className="pa-annotation-preview-target">{activePin.target}</span>
          <span className="pa-annotation-preview-note">{activePin.note}</span>
        </div>
      )}
    </>
  );
}
