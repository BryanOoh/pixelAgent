const VIEWPORT_MARGIN = 8;
const ANCHOR_GAP = 8;
const TOOLBAR_PAD = 12;
const DEFAULT_PANEL_WIDTH = 300;
const DEFAULT_PANEL_HEIGHT = 280;

type Box = {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

function positionToBox(top: number, left: number, width: number, height: number): Box {
  return {
    top,
    left,
    right: left + width,
    bottom: top + height,
    width,
    height,
  };
}

function boxesOverlap(a: Box, b: Box): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function inflateRect(rect: DOMRect, pad: number): Box {
  return {
    top: rect.top - pad,
    left: rect.left - pad,
    right: rect.right + pad,
    bottom: rect.bottom + pad,
    width: rect.width + pad * 2,
    height: rect.height + pad * 2,
  };
}

/** Floating toolbar portal — treat as a no-go zone for the annotate popover. */
export function getToolbarObstacle(): Box | null {
  if (typeof document === 'undefined') return null;
  const toolbar = document.querySelector(
    '[data-pixelagent-toolbar-portal] .pa-toolbar-float'
  );
  if (!toolbar) return null;
  return inflateRect(toolbar.getBoundingClientRect(), TOOLBAR_PAD);
}

function clampHorizontal(left: number, panelWidth: number): number {
  return Math.min(
    Math.max(VIEWPORT_MARGIN, left),
    window.innerWidth - panelWidth - VIEWPORT_MARGIN
  );
}

function clampVertical(top: number, panelHeight: number): number {
  return Math.min(
    Math.max(VIEWPORT_MARGIN, top),
    window.innerHeight - panelHeight - VIEWPORT_MARGIN
  );
}

function fitsViewport(box: Box): boolean {
  return (
    box.top >= VIEWPORT_MARGIN &&
    box.left >= VIEWPORT_MARGIN &&
    box.right <= window.innerWidth - VIEWPORT_MARGIN &&
    box.bottom <= window.innerHeight - VIEWPORT_MARGIN
  );
}

function isValidPlacement(box: Box, obstacle: Box | null): boolean {
  if (obstacle && boxesOverlap(box, obstacle)) return false;
  return fitsViewport(box);
}

/**
 * Place the annotate note popover beside the anchor without covering the toolbar.
 * Prefers above when the anchor sits in the lower half of the viewport.
 */
export function computeAnnotationPopoverPosition(
  anchorRect: DOMRect,
  panelWidth = DEFAULT_PANEL_WIDTH,
  panelHeight = DEFAULT_PANEL_HEIGHT
): { top: number; left: number } {
  const obstacle = getToolbarObstacle();
  const preferAbove = anchorRect.top > window.innerHeight * 0.45;

  const candidates: Array<{ placement: 'below' | 'above' | 'right' | 'left'; top: number; left: number }> =
    preferAbove
      ? [
          { placement: 'above', top: anchorRect.top - panelHeight - ANCHOR_GAP, left: anchorRect.left },
          { placement: 'below', top: anchorRect.bottom + ANCHOR_GAP, left: anchorRect.left },
          { placement: 'right', top: anchorRect.top, left: anchorRect.right + ANCHOR_GAP },
          { placement: 'left', top: anchorRect.top, left: anchorRect.left - panelWidth - ANCHOR_GAP },
        ]
      : [
          { placement: 'below', top: anchorRect.bottom + ANCHOR_GAP, left: anchorRect.left },
          { placement: 'above', top: anchorRect.top - panelHeight - ANCHOR_GAP, left: anchorRect.left },
          { placement: 'right', top: anchorRect.top, left: anchorRect.right + ANCHOR_GAP },
          { placement: 'left', top: anchorRect.top, left: anchorRect.left - panelWidth - ANCHOR_GAP },
        ];

  for (const { top, left } of candidates) {
    const box = positionToBox(
      clampVertical(top, panelHeight),
      clampHorizontal(left, panelWidth),
      panelWidth,
      panelHeight
    );
    if (isValidPlacement(box, obstacle)) {
      return { top: box.top, left: box.left };
    }
  }

  // Fallback: nudge away from toolbar, prefer above anchor
  let top = clampVertical(anchorRect.top - panelHeight - ANCHOR_GAP, panelHeight);
  let left = clampHorizontal(anchorRect.left, panelWidth);

  if (obstacle) {
    let box = positionToBox(top, left, panelWidth, panelHeight);
    if (boxesOverlap(box, obstacle)) {
      top = clampVertical(obstacle.top - panelHeight - ANCHOR_GAP, panelHeight);
      box = positionToBox(top, left, panelWidth, panelHeight);
    }
    if (boxesOverlap(box, obstacle)) {
      top = clampVertical(anchorRect.bottom + ANCHOR_GAP, panelHeight);
      left = clampHorizontal(
        Math.min(anchorRect.left, obstacle.left - panelWidth - ANCHOR_GAP),
        panelWidth
      );
    }
  }

  return { top, left };
}
