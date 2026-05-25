/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest';
import { computeAnnotationPopoverPosition } from './popoverPosition.js';

describe('computeAnnotationPopoverPosition', () => {
  it('places popover above anchor in lower viewport when no toolbar', () => {
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
    Object.defineProperty(window, 'innerWidth', { value: 1200, configurable: true });

    const anchor = new DOMRect(100, 600, 200, 24);
    const pos = computeAnnotationPopoverPosition(anchor);

    expect(pos.top + 280).toBeLessThanOrEqual(600 - 8 + 2);
  });

  it('places popover below anchor in upper viewport', () => {
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
    Object.defineProperty(window, 'innerWidth', { value: 1200, configurable: true });

    const anchor = new DOMRect(100, 120, 200, 24);
    const pos = computeAnnotationPopoverPosition(anchor);

    expect(pos.top).toBeGreaterThanOrEqual(120 + 24 + 8 - 2);
  });
});
