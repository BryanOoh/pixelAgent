/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest';
import { getPreviewTargets } from './edit-preview.js';

describe('getPreviewTargets', () => {
  it('returns only the selected element for this-instance', () => {
    const el = document.createElement('button');
    el.className = 'alpha';
    document.body.appendChild(el);

    const other = document.createElement('button');
    other.className = 'alpha';
    document.body.appendChild(other);

    const targets = getPreviewTargets(el, 'this-instance');
    expect(targets).toEqual([el]);

    el.remove();
    other.remove();
  });

  it('returns all matching elements for all-instances', () => {
    const a = document.createElement('span');
    a.className = 'beta';
    const b = document.createElement('span');
    b.className = 'beta';
    document.body.append(a, b);

    const targets = getPreviewTargets(a, 'all-instances');
    expect(targets).toHaveLength(2);

    a.remove();
    b.remove();
  });
});
