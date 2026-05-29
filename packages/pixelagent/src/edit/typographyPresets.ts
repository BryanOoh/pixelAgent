import { parseLength } from './propertyControls.js';

export interface TypographyPreset {
  /** Token key, e.g. "h1", "2xl", "body". */
  id: string;
  /** Display label, e.g. "H1", "2XL", "Body". */
  label: string;
  /** Source CSS custom property, e.g. "--text-h1". */
  varName: string;
  /** Resolved font-size in px (rem/em normalized against root). */
  fontSize: string;
  /** Resolved line-height (px when a length, unitless kept as-is), or null. */
  lineHeight: string | null;
  /** Resolved font-weight, or null. */
  fontWeight: string | null;
}

// A font-size token: `--text-<key>` (Tailwind v4) or `--font-size-<key>`.
const FONT_SIZE_VAR_RE = /^--(?:text|font-size)-(.+)$/;

// Companion suffixes attached to a font-size base (Tailwind v4 shape:
// `--text-2xl--line-height`). These are NOT presets themselves.
const COMPANION_SUFFIXES = ['--line-height', '--font-weight', '--letter-spacing'];

// Custom-property name prefixes worth resolving when scanning a document.
export const TYPOGRAPHY_VAR_PREFIXES = [
  '--text-',
  '--font-',
  '--leading-',
  '--line-height-',
] as const;

function isLength(value: string): boolean {
  const parsed = parseLength(value);
  return parsed !== null && (parsed.unit === 'px' || parsed.unit === 'rem' || parsed.unit === 'em');
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Normalize a length token to px; leave unitless/other units untouched. */
function lengthToPx(value: string, rootFontSizePx: number): string {
  const parsed = parseLength(value);
  if (!parsed) return value;
  if (parsed.unit === 'px') return `${round(parsed.num)}px`;
  if (parsed.unit === 'rem') return `${round(parsed.num * rootFontSizePx)}px`;
  return value;
}

function capitalize(word: string): string {
  return word ? word[0].toUpperCase() + word.slice(1) : word;
}

/** "h1" → "H1", "2xl" → "2XL", "body" → "Body", "display-large" → "Display Large". */
function humanizeKey(key: string): string {
  if (/^h[1-6]$/i.test(key)) return key.toUpperCase();
  const words = key.split(/[-_]/).filter(Boolean);
  return words
    .map((w) => (/^\d*x?[sl]?$|^\d*xl$|^xs$|^sm$|^md$|^lg$|^xl$/i.test(w) ? w.toUpperCase() : capitalize(w)))
    .join(' ');
}

function endsWithCompanion(name: string): boolean {
  return COMPANION_SUFFIXES.some((suffix) => name.endsWith(suffix));
}

/**
 * Derive Figma-style typography presets from a flat map of resolved CSS custom
 * properties. Recognizes Tailwind v4 (`--text-<key>` + `--text-<key>--line-height`)
 * and semantic (`--font-size-<key>` + `--leading-<key>`) conventions. Tokens
 * whose value is not a length (e.g. a `--text-primary` color) are ignored.
 * Sorted largest font-size first to mirror Figma's text-style list.
 */
export function parseTypographyPresets(
  vars: Record<string, string>,
  rootFontSizePx = 16
): TypographyPreset[] {
  const presets: TypographyPreset[] = [];

  for (const [name, rawValue] of Object.entries(vars)) {
    if (endsWithCompanion(name)) continue;
    const match = name.match(FONT_SIZE_VAR_RE);
    if (!match) continue;

    const value = rawValue.trim();
    if (!isLength(value)) continue;

    const key = match[1];

    const lineHeightRaw =
      vars[`${name}--line-height`] ?? vars[`--leading-${key}`] ?? vars[`--line-height-${key}`] ?? null;
    const fontWeightRaw = vars[`${name}--font-weight`] ?? vars[`--font-weight-${key}`] ?? null;

    presets.push({
      id: key,
      label: humanizeKey(key),
      varName: name,
      fontSize: lengthToPx(value, rootFontSizePx),
      lineHeight: lineHeightRaw ? lengthToPx(lineHeightRaw.trim(), rootFontSizePx) : null,
      fontWeight: fontWeightRaw ? fontWeightRaw.trim() : null,
    });
  }

  presets.sort((a, b) => (parseLength(b.fontSize)?.num ?? 0) - (parseLength(a.fontSize)?.num ?? 0));
  return presets;
}

/** Format a preset for display: "57/64" (size/line-height) or "57" when no line-height. */
export function formatPresetMetrics(preset: TypographyPreset): string {
  const size = preset.fontSize.replace(/px$/, '');
  if (!preset.lineHeight) return size;
  return `${size}/${preset.lineHeight.replace(/px$/, '')}`;
}

function pxNumber(value: string | null | undefined): number | null {
  if (!value) return null;
  return parseLength(value)?.num ?? null;
}

/**
 * Find the preset whose values match the element's current typography, so the
 * dropdown can show the active selection. Matches on font-size (required) and
 * prefers a candidate whose line-height also matches.
 */
export function matchPreset(
  presets: TypographyPreset[],
  fontSize: string,
  lineHeight: string
): TypographyPreset | null {
  const targetSize = pxNumber(fontSize);
  if (targetSize === null) return null;
  const targetLine = pxNumber(lineHeight);

  const sizeMatches = presets.filter((p) => {
    const n = pxNumber(p.fontSize);
    return n !== null && Math.abs(n - targetSize) < 0.5;
  });
  if (sizeMatches.length === 0) return null;

  if (targetLine !== null) {
    const withLine = sizeMatches.find((p) => {
      const n = pxNumber(p.lineHeight);
      return n !== null && Math.abs(n - targetLine) < 0.5;
    });
    if (withLine) return withLine;
  }
  return sizeMatches[0];
}

function collectCustomPropNames(doc: Document): Set<string> {
  const names = new Set<string>();

  const visit = (rules: CSSRuleList | undefined) => {
    if (!rules) return;
    for (const rule of Array.from(rules)) {
      const styleRule = rule as CSSStyleRule;
      if (styleRule.style) {
        for (let i = 0; i < styleRule.style.length; i++) {
          const prop = styleRule.style[i];
          if (prop.startsWith('--') && TYPOGRAPHY_VAR_PREFIXES.some((p) => prop.startsWith(p))) {
            names.add(prop);
          }
        }
      }
      // Recurse into grouping rules (@media, @supports, @layer).
      const nested = (rule as CSSGroupingRule).cssRules;
      if (nested) visit(nested);
    }
  };

  for (const sheet of Array.from(doc.styleSheets)) {
    try {
      visit(sheet.cssRules);
    } catch {
      // Cross-origin stylesheets throw on cssRules access — skip them.
    }
  }

  return names;
}

/** Read typography presets from the live document's :root custom properties. */
export function readTypographyPresets(): TypographyPreset[] {
  if (typeof document === 'undefined') return [];

  const names = collectCustomPropNames(document);
  const root = document.documentElement;
  const computed = getComputedStyle(root);

  const vars: Record<string, string> = {};
  for (const name of names) {
    const value = computed.getPropertyValue(name).trim();
    if (value) vars[name] = value;
  }

  const rootFontSizePx = parseFloat(computed.fontSize) || 16;
  return parseTypographyPresets(vars, rootFontSizePx);
}
