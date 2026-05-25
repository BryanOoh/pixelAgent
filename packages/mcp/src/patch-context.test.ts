import { describe, expect, it } from 'vitest';
import {
  cssRuleKey,
  expectedVariantPrefix,
  prefixTailwindUtility,
  tailwindClassMatchesContext,
} from './patch-context.js';

describe('patch-context', () => {
  it('prefixes tailwind utilities with state and md breakpoint', () => {
    const ctx = { state: 'hover' as const, targetScope: 'all-instances' as const };
    expect(prefixTailwindUtility('p-4', ctx)).toBe('md:hover:p-4');
    expect(expectedVariantPrefix(ctx)).toBe('md:hover:');
    expect(tailwindClassMatchesContext('md:hover:p-4', ctx)).toBe(true);
    expect(tailwindClassMatchesContext('p-4', ctx)).toBe(false);
  });

  it('builds css rule keys for pseudo states', () => {
    expect(cssRuleKey('btn', { state: 'hover', targetScope: 'all-instances' })).toBe('btn:hover');
    expect(cssRuleKey('btn', { state: 'normal', targetScope: 'this-instance' })).toBe('btn');
  });
});
