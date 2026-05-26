import { describe, expect, it } from 'vitest';
import { hsvToRgb, parseCssColor, rgbToHex, rgbToHsv } from './colorModel.js';

describe('colorModel', () => {
  it('round-trips AF5F5F', () => {
    const rgb = parseCssColor('#AF5F5F')!;
    expect(rgb).toEqual({ r: 175, g: 95, b: 95 });
    const hsv = rgbToHsv(rgb);
    const back = hsvToRgb(hsv);
    expect(rgbToHex(back).toUpperCase()).toBe('#AF5F5F');
  });

  it('parses rgb()', () => {
    expect(parseCssColor('rgb(175, 95, 95)')).toEqual({ r: 175, g: 95, b: 95 });
  });
});
