import type { AnnotationEntry } from '@pixelagent/shared';
import { resolveElementFromEntry } from '@pixelagent/shared';

/** Screen-space anchor for an annotation pin (live element preferred). */
export function getAnnotationAnchorRect(entry: AnnotationEntry): DOMRect | null {
  const el = resolveElementFromEntry(entry);
  if (el) return el.getBoundingClientRect();

  if (entry.bbox) {
    const { x, y, width, height } = entry.bbox;
    return new DOMRect(x, y, width, height);
  }

  if (entry.areaBbox) {
    const { x, y, width, height } = entry.areaBbox;
    return new DOMRect(x, y, width, height);
  }

  if (entry.position) {
    const { x, y } = entry.position;
    return new DOMRect(x, y, 1, 1);
  }

  return null;
}

export function anchorRectKey(rect: DOMRect): string {
  return `${Math.round(rect.top)}:${Math.round(rect.left)}:${Math.round(rect.width)}:${Math.round(rect.height)}`;
}
