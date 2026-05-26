import { describe, expect, it } from 'vitest';
import {
  isBoldWeight,
  toggleBoldWeight,
  toggleTextDecoration,
} from './styleUtils.js';

describe('styleUtils', () => {
  it('toggles bold weight', () => {
    expect(toggleBoldWeight('400')).toBe('700');
    expect(toggleBoldWeight('700')).toBe('400');
    expect(isBoldWeight('600')).toBe(true);
  });

  it('combines text decorations', () => {
    expect(toggleTextDecoration('none', 'underline')).toBe('underline');
    expect(toggleTextDecoration('underline', 'line-through')).toBe('underline line-through');
    expect(toggleTextDecoration('underline line-through', 'underline')).toBe('line-through');
  });
});
