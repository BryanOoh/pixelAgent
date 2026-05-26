/** Parse a single px length from computed CSS (e.g. "72px"). */
export function parsePx(value: string): number | null {
  const match = value.trim().match(/^(-?\d+(?:\.\d+)?)px$/i);
  return match ? parseFloat(match[1]) : null;
}

/** Parse opacity from "0.85" or "85%". */
export function parseOpacity(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.endsWith('%')) {
    const n = parseFloat(trimmed);
    return Number.isFinite(n) ? n / 100 : null;
  }
  const n = parseFloat(trimmed);
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : null;
}

/** True when a border-width value represents a visible stroke (uniform or single px). */
export function hasPositiveBorderWidth(value: string): boolean {
  const uniform = parseUniformPx(value);
  if (uniform !== null) return uniform > 0;
  const single = parsePx(value);
  return single !== null && single > 0;
}

/** True when all sides share the same px length (slider-safe). */
export function parseUniformPx(value: string): number | null {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;

  const parsed = parts.map((p) => parsePx(p));
  if (parsed.some((n) => n === null)) return null;
  const first = parsed[0]!;
  if (parsed.every((n) => n === first)) return first;
  return null;
}

export type PropControlKind = 'text' | 'opacity' | 'px' | 'uniform-px';

export interface PropControlConfig {
  kind: PropControlKind;
  min?: number;
  max?: number;
  step?: number;
}

export const PROP_CONTROLS: Record<string, PropControlConfig> = {
  padding: { kind: 'uniform-px', min: 0, max: 80, step: 1 },
  margin: { kind: 'uniform-px', min: 0, max: 80, step: 1 },
  width: { kind: 'text' },
  height: { kind: 'text' },
  'background-color': { kind: 'text' },
  color: { kind: 'text' },
  'font-size': { kind: 'px', min: 8, max: 128, step: 1 },
  'line-height': { kind: 'text' },
  gap: { kind: 'uniform-px', min: 0, max: 80, step: 1 },
  'border-width': { kind: 'uniform-px', min: 0, max: 24, step: 1 },
  'border-radius': { kind: 'px', min: 0, max: 48, step: 1 },
  opacity: { kind: 'opacity', min: 0, max: 1, step: 0.01 },
};

export function sliderValueForProperty(
  _property: string,
  cssValue: string,
  config: PropControlConfig
): number | null {
  switch (config.kind) {
    case 'opacity':
      return parseOpacity(cssValue);
    case 'px':
      return parsePx(cssValue);
    case 'uniform-px':
      return parseUniformPx(cssValue);
    default:
      return null;
  }
}

export function formatSliderValue(_property: string, num: number, config: PropControlConfig): string {
  switch (config.kind) {
    case 'opacity':
      return String(Math.round(num * 100) / 100);
    case 'px':
    case 'uniform-px':
      return `${Math.round(num)}px`;
    default:
      return String(num);
  }
}
