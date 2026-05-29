import { describe, expect, it } from 'vitest';
import type { PatchContext } from './patch-context.js';
import { patchTailwindLine, toTailwindClass } from './tailwind-patcher.js';

const hover: PatchContext = { state: 'hover', targetScope: 'this-instance' };
const normal: PatchContext = { state: 'normal', targetScope: 'this-instance' };
const focus: PatchContext = { state: 'focus', targetScope: 'this-instance' };

describe('toTailwindClass', () => {
  it('snaps spacing to the default scale', () => {
    expect(toTailwindClass('padding', '16px')).toBe('p-4');
  });

  it('falls back to arbitrary value when off-scale', () => {
    expect(toTailwindClass('padding', '13px')).toBe('p-[13px]');
  });

  it('always uses an arbitrary value for colors', () => {
    expect(toTailwindClass('color', '#0000ff')).toBe('text-[#0000ff]');
  });
});

describe('patchTailwindLine — normal state', () => {
  it('emits the new utility and leaves unrelated utilities alone', () => {
    const line = '<div className="p-2 bg-white">';
    const { line: out, changed } = patchTailwindLine(
      line,
      { property: 'padding', oldValue: '8px', newValue: '16px' },
      normal
    );
    expect(changed).toBe(true);
    expect(out).toContain('bg-white'); // unrelated utility untouched
    expect(out).toContain('md:p-4'); // new padding utility added
  });

  // KNOWN LIMITATION: prefixTailwindUtility() hard-codes an `md:` breakpoint
  // prefix (ignoring payload.viewport), so a normal-state edit does NOT replace
  // the un-prefixed base utility — it keeps `p-2` and adds `md:p-4`. Below the
  // md breakpoint the old value still applies. Captured here so the behavior is
  // visible; flagged separately from the pseudo-state work.
  it('currently keeps the un-prefixed base utility (md: responsive prefix quirk)', () => {
    const line = '<div className="p-2">';
    const { line: out } = patchTailwindLine(
      line,
      { property: 'padding', oldValue: '8px', newValue: '16px' },
      normal
    );
    expect(out).toContain('p-2');
    expect(out).toContain('md:p-4');
  });
});

describe('patchTailwindLine — pseudo-state (anti-pollution)', () => {
  it('adds a hover: variant WITHOUT touching the resting/normal utility', () => {
    const line = '<button className="text-white p-4">';
    const { line: out, changed } = patchTailwindLine(
      line,
      { property: 'color', oldValue: 'rgb(255,255,255)', newValue: '#0000ff' },
      hover
    );
    expect(changed).toBe(true);
    // The normal-state color class survives — hover must not bleed into resting.
    expect(out).toContain('text-white');
    expect(out).toContain('p-4');
    expect(out).toContain('md:hover:text-[#0000ff]');
  });

  it('replaces an existing hover utility for the same property instead of duplicating', () => {
    const line = '<button className="text-white md:hover:text-red-500 p-4">';
    const { line: out } = patchTailwindLine(
      line,
      { property: 'color', oldValue: 'rgb(255,0,0)', newValue: '#0000ff' },
      hover
    );
    expect(out).toContain('text-white'); // resting kept
    expect(out).not.toContain('text-red-500'); // old hover color replaced
    expect(out).toContain('md:hover:text-[#0000ff]');
    // exactly one hover color utility
    expect(out.match(/md:hover:text-/g)?.length).toBe(1);
  });

  it('uses the focus: variant for the focus state', () => {
    const line = '<button className="bg-white">';
    const { line: out } = patchTailwindLine(
      line,
      { property: 'background-color', oldValue: '#fff', newValue: '#000' },
      focus
    );
    expect(out).toContain('bg-white'); // resting kept
    expect(out).toContain('md:focus:bg-[#000]');
  });
});

describe('patchTailwindLine — precision & guards', () => {
  it('editing font-size does not strip a text color utility sharing the text- prefix', () => {
    const line = '<p className="text-blue-500 text-sm">';
    const { line: out } = patchTailwindLine(
      line,
      { property: 'font-size', oldValue: '14px', newValue: '16px' },
      normal
    );
    expect(out).toContain('text-blue-500'); // color survives (precision matcher)
    expect(out).toContain('md:text-base'); // new font-size utility added
  });

  it('warns and does not change a className that is a JS expression', () => {
    const line = '<div className={cx("p-4", active && "p-8")}>';
    const { changed, warning } = patchTailwindLine(
      line,
      { property: 'padding', oldValue: '16px', newValue: '8px' },
      normal
    );
    expect(changed).toBe(false);
    expect(warning).toMatch(/STYLING_AMBIGUOUS/);
  });

  it('warns when no Tailwind mapping exists for the property', () => {
    const line = '<div className="p-4">';
    const { changed, warning } = patchTailwindLine(
      line,
      { property: 'cursor', oldValue: 'auto', newValue: 'pointer' },
      normal
    );
    expect(changed).toBe(false);
    expect(warning).toMatch(/No Tailwind mapping/);
  });
});
