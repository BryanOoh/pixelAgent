/** @vitest-environment jsdom */
import { afterEach, describe, expect, it } from 'vitest';
import {
  applyTailwindStatePreview,
  clearTailwindStatePreview,
  getPreviewTargets,
  PA_PREVIEW_CLASSES_ATTR,
  PA_PREVIEW_DISABLED_CLASS,
} from './edit-preview.js';
import { readStateRuleDeclarations } from './dom.js';

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

describe('applyTailwindStatePreview', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('is a no-op for the normal state', () => {
    const el = document.createElement('div');
    el.className = 'hover:opacity-50';
    document.body.appendChild(el);

    applyTailwindStatePreview([el], 'normal');

    expect(el.classList.contains('opacity-50')).toBe(false);
    expect(el.getAttribute(PA_PREVIEW_CLASSES_ATTR)).toBeNull();
  });

  it('strips the hover: variant prefix so the base utility renders', () => {
    const el = document.createElement('div');
    el.className = 'hover:opacity-50 hover:bg-red';
    document.body.appendChild(el);

    applyTailwindStatePreview([el], 'hover');

    expect(el.classList.contains('opacity-50')).toBe(true);
    expect(el.classList.contains('bg-red')).toBe(true);
    expect(el.getAttribute(PA_PREVIEW_CLASSES_ATTR)).toBe('opacity-50 bg-red');
  });

  it('does not re-add a base utility that is already present', () => {
    const el = document.createElement('div');
    el.className = 'opacity-50 hover:opacity-50';
    document.body.appendChild(el);

    applyTailwindStatePreview([el], 'hover');

    // opacity-50 was already on the element, so nothing should be tracked.
    expect(el.getAttribute(PA_PREVIEW_CLASSES_ATTR)).toBeNull();
    expect(el.className).toBe('opacity-50 hover:opacity-50');
  });

  it('focuses the element for the focus state', () => {
    const btn = document.createElement('button');
    document.body.appendChild(btn);

    applyTailwindStatePreview([btn], 'focus');

    expect(document.activeElement).toBe(btn);
  });

  it('disables form controls for the disabled state', () => {
    const btn = document.createElement('button');
    document.body.appendChild(btn);

    applyTailwindStatePreview([btn], 'disabled');

    expect(btn.disabled).toBe(true);
  });

  it('uses aria-disabled + a marker class for non-form elements', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);

    applyTailwindStatePreview([el], 'disabled');

    expect(el.getAttribute('aria-disabled')).toBe('true');
    expect(el.classList.contains(PA_PREVIEW_DISABLED_CLASS)).toBe(true);
  });

  it('re-applying a new state clears the previous one first', () => {
    const el = document.createElement('div');
    el.className = 'hover:opacity-50';
    document.body.appendChild(el);

    applyTailwindStatePreview([el], 'hover');
    expect(el.classList.contains('opacity-50')).toBe(true);

    applyTailwindStatePreview([el], 'disabled');
    expect(el.classList.contains('opacity-50')).toBe(false);
    expect(el.getAttribute(PA_PREVIEW_CLASSES_ATTR)).toBeNull();
    expect(el.getAttribute('aria-disabled')).toBe('true');
  });
});

describe('clearTailwindStatePreview', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('removes injected variant classes and restores the original className', () => {
    const el = document.createElement('div');
    el.className = 'hover:opacity-50';
    document.body.appendChild(el);

    applyTailwindStatePreview([el], 'hover');
    clearTailwindStatePreview([el]);

    expect(el.classList.contains('opacity-50')).toBe(false);
    expect(el.getAttribute(PA_PREVIEW_CLASSES_ATTR)).toBeNull();
    expect(el.className).toBe('hover:opacity-50');
  });

  it('re-enables a disabled form control and clears disabled markers', () => {
    const btn = document.createElement('button');
    const div = document.createElement('div');
    document.body.append(btn, div);

    applyTailwindStatePreview([btn, div], 'disabled');
    clearTailwindStatePreview([btn, div]);

    expect(btn.disabled).toBe(false);
    expect(div.getAttribute('aria-disabled')).toBeNull();
    expect(div.classList.contains(PA_PREVIEW_DISABLED_CLASS)).toBe(false);
  });
});

describe('readStateRuleDeclarations', () => {
  afterEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
  });

  it('returns declarations from a matching :hover rule', () => {
    const style = document.createElement('style');
    style.textContent = '.btn:hover { opacity: 0.5; color: rgb(1, 2, 3); }';
    document.head.appendChild(style);

    const el = document.createElement('button');
    el.className = 'btn';
    document.body.appendChild(el);

    const decls = readStateRuleDeclarations(el, 'hover');
    expect(decls.opacity).toBe('0.5');
    expect(decls.color).toBe('rgb(1, 2, 3)');
  });

  it('ignores rules for a different pseudo-state', () => {
    const style = document.createElement('style');
    style.textContent = '.btn:focus { outline: 2px solid red; }';
    document.head.appendChild(style);

    const el = document.createElement('button');
    el.className = 'btn';
    document.body.appendChild(el);

    expect(readStateRuleDeclarations(el, 'hover')).toEqual({});
    expect(readStateRuleDeclarations(el, 'focus').outline).toContain('2px');
  });

  it('returns nothing when the element does not match the rule base selector', () => {
    const style = document.createElement('style');
    style.textContent = '.other:hover { opacity: 0.5; }';
    document.head.appendChild(style);

    const el = document.createElement('button');
    el.className = 'btn';
    document.body.appendChild(el);

    expect(readStateRuleDeclarations(el, 'hover')).toEqual({});
  });
});
