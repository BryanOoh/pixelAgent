/** @vitest-environment jsdom */
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { ElementState, TargetScope } from '@pixelagent/shared';
import { useEditPreview } from './useEditPreview';

type Props = { el: Element | null; scope: TargetScope; state: ElementState };

function render(initial: Props) {
  return renderHook(({ el, scope, state }: Props) => useEditPreview(el, scope, state), {
    initialProps: initial,
  });
}

// jsdom does not implement innerText (returns undefined), which getEditableTextInfo
// reads on every selected element. Mirror it onto textContent so elements behave
// like a browser.
if (!Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'innerText')) {
  Object.defineProperty(HTMLElement.prototype, 'innerText', {
    configurable: true,
    get(this: HTMLElement) {
      return this.textContent;
    },
  });
}

afterEach(() => {
  document.body.innerHTML = '';
  document.head.innerHTML = '';
});

describe('useEditPreview — scope', () => {
  it('reapplies a this-instance edit to every instance when scope expands', () => {
    const a = document.createElement('button');
    a.className = 'btn';
    const b = document.createElement('button');
    b.className = 'btn';
    document.body.append(a, b);

    const { result, rerender } = render({ el: a, scope: 'this-instance', state: 'normal' });

    act(() => result.current.updateProperty('font-size', '22px'));
    expect(a.style.fontSize).toBe('22px');
    expect(b.style.fontSize).toBe('');

    rerender({ el: a, scope: 'all-instances', state: 'normal' });
    expect(a.style.fontSize).toBe('22px');
    expect(b.style.fontSize).toBe('22px');
  });

  it('reset reverts inline edits on ALL instances after a scope expand (regression)', () => {
    const a = document.createElement('button');
    a.className = 'btn';
    const b = document.createElement('button');
    b.className = 'btn';
    document.body.append(a, b);

    const { result, rerender } = render({ el: a, scope: 'this-instance', state: 'normal' });

    act(() => result.current.updateProperty('font-size', '22px'));
    rerender({ el: a, scope: 'all-instances', state: 'normal' });
    expect(b.style.fontSize).toBe('22px');

    act(() => result.current.reset());

    // Before the fix `b` (added by the scope expansion) kept its 22px override
    // because initialInlineRef only snapshotted the original this-instance target.
    expect(a.style.fontSize).toBe('');
    expect(b.style.fontSize).toBe('');
  });

  it('revertPreviews clears every instance touched at all-instances scope', () => {
    const a = document.createElement('button');
    a.className = 'btn';
    const b = document.createElement('button');
    b.className = 'btn';
    document.body.append(a, b);

    const { result, rerender } = render({ el: a, scope: 'this-instance', state: 'normal' });
    act(() => result.current.updateProperty('font-size', '22px'));
    rerender({ el: a, scope: 'all-instances', state: 'normal' });

    act(() => result.current.revertPreviews());

    expect(a.style.fontSize).toBe('');
    expect(b.style.fontSize).toBe('');
  });
});

describe('useEditPreview — state', () => {
  it('does not bleed a normal-state edit into the hover preview', () => {
    const a = document.createElement('button');
    a.className = 'only-btn';
    document.body.append(a);

    const { result, rerender } = render({ el: a, scope: 'this-instance', state: 'normal' });

    act(() => result.current.updateProperty('font-size', '22px'));
    expect(a.style.fontSize).toBe('22px');

    rerender({ el: a, scope: 'this-instance', state: 'hover' });
    expect(a.style.fontSize).toBe('');

    rerender({ el: a, scope: 'this-instance', state: 'normal' });
    expect(a.style.fontSize).toBe('22px');
  });

  it('surfaces an existing :hover rule as the inline preview', () => {
    const style = document.createElement('style');
    style.textContent = '.hov:hover { opacity: 0.5; }';
    document.head.appendChild(style);

    const a = document.createElement('button');
    a.className = 'hov';
    document.body.append(a);

    const { rerender } = render({ el: a, scope: 'this-instance', state: 'normal' });
    expect(a.style.opacity).toBe('');

    rerender({ el: a, scope: 'this-instance', state: 'hover' });
    expect(a.style.opacity).toBe('0.5');

    rerender({ el: a, scope: 'this-instance', state: 'normal' });
    expect(a.style.opacity).toBe('');
  });

  it('buckets pending changes by (element, state)', () => {
    const a = document.createElement('button');
    a.className = 'bkt';
    document.body.append(a);

    const { result, rerender } = render({ el: a, scope: 'this-instance', state: 'normal' });

    act(() => result.current.updateProperty('font-size', '22px'));
    rerender({ el: a, scope: 'this-instance', state: 'hover' });
    act(() => result.current.updateProperty('color', 'rgb(255, 0, 0)'));

    expect(result.current.totalPendingCount).toBe(2);
    const buckets = result.current.pendingByElement.get(a);
    expect(buckets?.get('normal')?.map((c) => c.property)).toEqual(['font-size']);
    expect(buckets?.get('hover')?.map((c) => c.property)).toEqual(['color']);
  });
});

describe('useEditPreview — text', () => {
  it('reset reverts text edits on ALL instances to their own originals (regression)', () => {
    const a = document.createElement('a');
    a.className = 'lnk';
    a.textContent = 'One';
    const b = document.createElement('a');
    b.className = 'lnk';
    b.textContent = 'Two';
    document.body.append(a, b);

    const { result, rerender } = render({ el: a, scope: 'this-instance', state: 'normal' });
    expect(result.current.textKind).toBe('textContent');

    rerender({ el: a, scope: 'all-instances', state: 'normal' });
    act(() => result.current.updateText('ZZZ'));
    expect(a.textContent).toBe('ZZZ');
    expect(b.textContent).toBe('ZZZ');

    act(() => result.current.reset());

    // Before the fix `b` kept 'ZZZ' because initialTextRef held a single snapshot.
    expect(a.textContent).toBe('One');
    expect(b.textContent).toBe('Two');
  });
});
