import { describe, expect, it } from 'vitest';
import { matchColorPreset, parseColorPresets } from './colorPresets.js';

describe('parseColorPresets', () => {
  it('parses hex and rgb(a) color tokens, ignoring non-colors', () => {
    const presets = parseColorPresets({
      '--color-ink': '#0a0a0a',
      '--color-accent-sunset': '#ff7a17',
      '--border-outline': 'rgba(255, 255, 255, 0.25)',
      '--space-md': '12px',
      '--text-h1': '57px',
      '--shadow': '0 1px 2px rgba(0,0,0,0.1)',
      '--font-display': 'Inter, sans-serif',
    });
    expect(presets.map((p) => p.id)).toEqual(['color-ink', 'color-accent-sunset', 'border-outline']);
  });

  it('humanizes names, stripping a leading color- namespace', () => {
    const presets = parseColorPresets({
      '--color-body-mid': '#7d8187',
      '--tok-keyword': '#93c5fd',
    });
    expect(presets[0].name).toBe('Body Mid');
    expect(presets[1].name).toBe('Tok Keyword');
  });

  it('keeps the raw value for the swatch', () => {
    const presets = parseColorPresets({ '--c': 'rgba(0, 0, 0, 0.5)' });
    expect(presets[0].value).toBe('rgba(0, 0, 0, 0.5)');
  });

  it('preserves discovery order', () => {
    const presets = parseColorPresets({
      '--color-z': '#111111',
      '--color-a': '#222222',
    });
    expect(presets.map((p) => p.id)).toEqual(['color-z', 'color-a']);
  });
});

describe('matchColorPreset', () => {
  const presets = parseColorPresets({
    '--color-ink': '#0a0a0a',
    '--color-body': '#dadbdf',
  });

  it('matches an rgb computed value against a hex token', () => {
    expect(matchColorPreset(presets, 'rgb(218, 219, 223)')?.id).toBe('color-body');
  });

  it('matches a hex value directly', () => {
    expect(matchColorPreset(presets, '#0a0a0a')?.id).toBe('color-ink');
  });

  it('returns null when nothing matches', () => {
    expect(matchColorPreset(presets, 'rgb(1, 2, 3)')).toBeNull();
  });
});
