export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface Hsv {
  h: number;
  s: number;
  v: number;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export function parseCssColor(value: string): Rgb | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const hex6 = trimmed.match(/^#([0-9a-f]{6})$/i);
  if (hex6) {
    return {
      r: parseInt(hex6[1].slice(0, 2), 16),
      g: parseInt(hex6[1].slice(2, 4), 16),
      b: parseInt(hex6[1].slice(4, 6), 16),
    };
  }

  const hex3 = trimmed.match(/^#([0-9a-f]{3})$/i);
  if (hex3) {
    const [r, g, b] = hex3[1].split('');
    return {
      r: parseInt(r + r, 16),
      g: parseInt(g + g, 16),
      b: parseInt(b + b, 16),
    };
  }

  const rgb = trimmed.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgb) {
    return {
      r: clamp(parseInt(rgb[1], 10), 0, 255),
      g: clamp(parseInt(rgb[2], 10), 0, 255),
      b: clamp(parseInt(rgb[3], 10), 0, 255),
    };
  }

  return null;
}

export function rgbToHex(rgb: Rgb): string {
  const h = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
  return `#${h(rgb.r)}${h(rgb.g)}${h(rgb.b)}`;
}

export function rgbToCss(rgb: Rgb): string {
  return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
}

export function rgbToHsv({ r, g, b }: Rgb): Hsv {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;

  let h = 0;
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }

  const s = max === 0 ? 0 : (d / max) * 100;
  const v = max * 100;

  return { h, s, v };
}

export function hsvToRgb({ h, s, v }: Hsv): Rgb {
  const sn = clamp(s, 0, 100) / 100;
  const vn = clamp(v, 0, 100) / 100;
  const c = vn * sn;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = vn - c;

  let rp = 0;
  let gp = 0;
  let bp = 0;
  const hue = ((h % 360) + 360) % 360;

  if (hue < 60) {
    rp = c;
    gp = x;
  } else if (hue < 120) {
    rp = x;
    gp = c;
  } else if (hue < 180) {
    gp = c;
    bp = x;
  } else if (hue < 240) {
    gp = x;
    bp = c;
  } else if (hue < 300) {
    rp = x;
    bp = c;
  } else {
    rp = c;
    bp = x;
  }

  return {
    r: Math.round((rp + m) * 255),
    g: Math.round((gp + m) * 255),
    b: Math.round((bp + m) * 255),
  };
}

export function hsvFromCss(value: string): Hsv {
  const rgb = parseCssColor(value);
  return rgb ? rgbToHsv(rgb) : { h: 0, s: 0, v: 45 };
}

/** @deprecated use parseCssColor + rgbToHex */
export function colorToHexInput(value: string): string | null {
  const rgb = parseCssColor(value);
  return rgb ? rgbToHex(rgb) : null;
}

export function formatHexInput(value: string): string {
  return value.replace(/^#/, '').toUpperCase().slice(0, 6);
}

export function parseHexInput(raw: string, fallback: Rgb): Rgb {
  const cleaned = raw.replace(/[^0-9a-f]/gi, '').slice(0, 6);
  if (cleaned.length < 6) return fallback;
  return (
    parseCssColor(`#${cleaned}`) ?? fallback
  );
}
