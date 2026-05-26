import { useEffect, useState } from 'react';
import { getElementDisplayLabel } from '@pixelagent/shared';

interface ElementOverlayProps {
  element: Element | null;
  selected: Element | null;
  multiSelected?: Element[];
  /** Which element was clicked (stronger ring when multiple are selected). */
  primarySelected?: Element | null;
}

export function ElementOverlay({
  element,
  selected,
  multiSelected = [],
  primarySelected = null,
}: ElementOverlayProps) {
  const [highlights, setHighlights] = useState<
    Array<{ rect: DOMRect; label: string; isSelected: boolean; isPrimary: boolean }>
  >([]);

  const primary = primarySelected ?? selected;

  useEffect(() => {
    const targets = new Map<Element, boolean>();
    const scopeMode = multiSelected.length > 0;

    if (element && !selected && !scopeMode) {
      targets.set(element, false);
    }
    if (selected) {
      targets.set(selected, true);
    }
    for (const el of multiSelected) {
      targets.set(el, true);
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
          isPrimary: primary !== null && el === primary,
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
  }, [element, selected, multiSelected, primary]);

  if (highlights.length === 0) return null;

  const tooltipAnchor =
    highlights.find((h) => h.isPrimary) ?? highlights.find((h) => h.isSelected) ?? highlights[0];
  const selectedCount = highlights.filter((h) => h.isSelected).length;

  return (
    <>
      {highlights.map((item, index) => (
        <div
          key={`${item.label}-${index}`}
          className={[
            'pa-highlight',
            item.isSelected ? 'pa-highlight-selected' : '',
            item.isPrimary ? 'pa-highlight-primary' : '',
            item.isSelected && !item.isPrimary && selectedCount > 1
              ? 'pa-highlight-scope'
              : '',
          ]
            .filter(Boolean)
            .join(' ')}
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
          top: Math.max(0, tooltipAnchor.rect.top - 28),
          left: tooltipAnchor.rect.left,
        }}
      >
        {selectedCount > 1
          ? `${selectedCount} instances · ${tooltipAnchor.label}`
          : tooltipAnchor.label}
      </div>
    </>
  );
}
