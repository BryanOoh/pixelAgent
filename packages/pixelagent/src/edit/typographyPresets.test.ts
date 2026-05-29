import { describe, expect, it } from 'vitest';
import {
  formatPresetMetrics,
  matchPreset,
  parseTypographyPresets,
} from './typographyPresets.js';

describe('parseTypographyPresets', () => {
  it('parses Tailwind v4 --text-<key> with companion line-height and font-weight', () => {
    const presets = parseTypographyPresets({
      '--text-h1': '57px',
      '--text-h1--line-height': '64px',
      '--text-h1--font-weight': '700',
    });
    expect(presets).toHaveLength(1);
    expect(presets[0]).toMatchObject({
      id: 'h1',
      label: 'H1',
      fontSize: '57px',
      lineHeight: '64px',
      fontWeight: '700',
    });
  });

  it('normalizes rem font-size and line-height to px against the root size', () => {
    const presets = parseTypographyPresets(
      { '--text-lg': '1.5rem', '--text-lg--line-height': '2rem' },
      16
    );
    expect(presets[0].fontSize).toBe('24px');
    expect(presets[0].lineHeight).toBe('32px');
  });

  it('keeps unitless line-height as-is', () => {
    const presets = parseTypographyPresets({
      '--text-body': '16px',
      '--text-body--line-height': '1.5',
    });
    expect(presets[0].lineHeight).toBe('1.5');
  });

  it('ignores --text-* tokens whose value is not a length (e.g. a color)', () => {
    const presets = parseTypographyPresets({
      '--text-primary': '#ffffff',
      '--text-h2': '45px',
    });
    expect(presets.map((p) => p.id)).toEqual(['h2']);
  });

  it('does not treat companion vars as standalone presets', () => {
    const presets = parseTypographyPresets({
      '--text-h1': '57px',
      '--text-h1--line-height': '64px',
    });
    expect(presets.map((p) => p.id)).toEqual(['h1']);
  });

  it('supports the --font-size-<key> + --leading-<key> convention', () => {
    const presets = parseTypographyPresets({
      '--font-size-title': '32px',
      '--leading-title': '40px',
    });
    expect(presets[0]).toMatchObject({ id: 'title', fontSize: '32px', lineHeight: '40px' });
  });

  it('sorts presets by font-size descending', () => {
    const presets = parseTypographyPresets({
      '--text-sm': '14px',
      '--text-h1': '57px',
      '--text-base': '16px',
    });
    expect(presets.map((p) => p.id)).toEqual(['h1', 'base', 'sm']);
  });
});

describe('formatPresetMetrics', () => {
  it('renders size/line-height without px units', () => {
    expect(
      formatPresetMetrics({
        id: 'h1',
        label: 'H1',
        varName: '--text-h1',
        fontSize: '57px',
        lineHeight: '64px',
        fontWeight: null,
      })
    ).toBe('57/64');
  });

  it('renders only the size when there is no line-height', () => {
    expect(
      formatPresetMetrics({
        id: 'h1',
        label: 'H1',
        varName: '--text-h1',
        fontSize: '57px',
        lineHeight: null,
        fontWeight: null,
      })
    ).toBe('57');
  });
});

describe('matchPreset', () => {
  const presets = parseTypographyPresets({
    '--text-h1': '57px',
    '--text-h1--line-height': '64px',
    '--text-h2': '45px',
    '--text-h2--line-height': '52px',
  });

  it('matches the active preset by font-size and line-height', () => {
    expect(matchPreset(presets, '45px', '52px')?.id).toBe('h2');
  });

  it('returns null when nothing matches the current font-size', () => {
    expect(matchPreset(presets, '13px', '20px')).toBeNull();
  });
});
