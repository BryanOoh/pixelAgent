import { useEffect, useState } from 'react';
import { getElementDisplayLabel } from '@pixelagent/shared';

interface ElementOverlayProps {
  element: Element | null;
  selected: Element | null;
  multiSelected?: Element[];
}

export function ElementOverlay({
  element,
  selected,
  multiSelected = [],
}: ElementOverlayProps) {
  const [highlights, setHighlights] = useState<
    Array<{ rect: DOMRect; label: string; isSelected: boolean }>
  >([]);

  useEffect(() => {
    const targets = new Map<Element, boolean>();

    if (element && !selected) {
      targets.set(element, false);
    }
    if (selected) {
      targets.set(selected, true);
    }
    for (const el of multiSelected) {
      if (el !== selected) targets.set(el, true);
    }

    if (targets.size === 0) {
      setHighlights([]);
      return;
    }

    const update = () => {
      setHighlights(
        Array.from(targets.entries()).map(([el, isSelected]) => ({
          rect: el.getBoundingClientRect(),
          label: getElementDisplayLabel(el),
          isSelected,
        }))
      );
    };

    update();

    const observers = Array.from(targets.keys()).map((el) => {
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
  }, [element, selected, multiSelected]);

  if (highlights.length === 0) return null;

  const primary = highlights.find((h) => h.isSelected) ?? highlights[0];

  return (
    <>
      {highlights.map((item, index) => (
        <div
          key={`${item.label}-${index}`}
          className={`pa-highlight ${item.isSelected ? 'pa-highlight-selected' : ''}`}
          style={{
            top: item.rect.top,
            left: item.rect.left,
            width: item.rect.width,
            height: item.rect.height,
          }}
        />
      ))}
      <div
        className="pa-tooltip"
        style={{
          top: Math.max(0, primary.rect.top - 28),
          left: primary.rect.left,
        }}
      >
        {highlights.length > 1 ? `${highlights.length} selected` : primary.label}
      </div>
    </>
  );
}
