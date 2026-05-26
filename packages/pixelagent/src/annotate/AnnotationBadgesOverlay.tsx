import { useEffect, useState } from 'react';
import type { AnnotationEntry } from '@pixelagent/shared';
import { resolveElementFromEntry } from '@pixelagent/shared';
import {
  anchorRectKey,
  getAnnotationAnchorRect,
} from './annotationAnchor';

export interface AnnotationBadgePin {
  id: string;
  index: number;
  top: number;
  left: number;
}

interface AnnotationBadgesOverlayProps {
  annotations: AnnotationEntry[];
}

const STACK_OFFSET_PX = 20;

export function AnnotationBadgesOverlay({ annotations }: AnnotationBadgesOverlayProps) {
  const [pins, setPins] = useState<AnnotationBadgePin[]>([]);

  useEffect(() => {
    if (annotations.length === 0) {
      setPins([]);
      return;
    }

    const stackAtKey = new Map<string, number>();

    const update = () => {
      const next: AnnotationBadgePin[] = [];

      annotations.forEach((entry, i) => {
        const rect = getAnnotationAnchorRect(entry);
        if (!rect) return;

        const key = anchorRectKey(rect);
        const stack = stackAtKey.get(key) ?? 0;
        stackAtKey.set(key, stack + 1);

        next.push({
          id: entry.id,
          index: i + 1,
          top: rect.top - 6 - stack * STACK_OFFSET_PX,
          left: rect.right - 6,
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

  return (
    <>
      {pins.map((pin) => (
        <span
          key={pin.id}
          className="pa-annotation-badge"
          style={{ top: pin.top, left: pin.left }}
          aria-hidden="true"
        >
          {pin.index}
        </span>
      ))}
    </>
  );
}
