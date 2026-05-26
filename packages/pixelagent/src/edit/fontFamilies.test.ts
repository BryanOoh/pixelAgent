import { describe, expect, it } from 'vitest';
import { resolveFontFamilySelectValue } from './fontFamilies.js';

describe('resolveFontFamilySelectValue', () => {
  it('matches Inter preset from computed stack', () => {
    const { selectValue } = resolveFontFamilySelectValue('Inter, system-ui, sans-serif');
    expect(selectValue).toBe('Inter, system-ui, sans-serif');
  });

  it('returns custom option for unknown fonts', () => {
    const { selectValue, options } = resolveFontFamilySelectValue('"Comic Sans MS", cursive');
    expect(selectValue).toBe('"Comic Sans MS", cursive');
    expect(options.some((o) => o.label === 'Comic Sans MS')).toBe(true);
  });
});
