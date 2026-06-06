import { parseCssColor, rgbToHex } from './colorModel.js';

export interface ColorPreset {
  /** Token key after `--`, e.g. "color-ink". */
  id: string;
  /** Display name, e.g. "Ink", "Accent Sunset". */
  name: string;
  /** Raw token value, used directly as the swatch color. */
  value: string;
  /** Source CSS custom property, e.g. "--color-ink". */
  varName: string;
}

function capitalize(word: string): string {
  return word ? word[0].toUpperCase() + word.slice(1) : word;
}

/** "--color-accent-sunset" → "Accent Sunset"; "--tok-keyword" → "Tok Keyword". */
function humanizeColorName(varName: string): string {
  const key = varName.replace(/^--/, '').replace(/^color-/, '');
  const words = (key || varName.replace(/^--/, '')).split(/[-_]/).filter(Boolean);
  return words.map(capitalize).join(' ');
}

/**
 * Derive color presets from a flat map of resolved CSS custom properties.
 * Any token whose value parses as a hex/rgb(a) color becomes a swatch; tokens
 * holding lengths, gradients, shadows, etc. are ignored. Discovery order is
 * preserved (roughly the declaration order in `:root`), which usually matches
 * the designer's intended palette order.
 */
export function parseColorPresets(vars: Record<string, string>): ColorPreset[] {
  const presets: ColorPreset[] = [];
  for (const [name, raw] of Object.entries(vars)) {
    const value = raw.trim();
    if (!value || !parseCssColor(value)) continue;
    presets.push({
      id: name.replace(/^--/, ''),
      name: humanizeColorName(name),
      value,
      varName: name,
    });
  }
  return presets;
}

/** Find the preset matching the element's current color (compared as hex). */
export function matchColorPreset(
  presets: ColorPreset[],
  currentColor: string
): ColorPreset | null {
  const current = parseCssColor(currentColor);
  if (!current) return null;
  const target = rgbToHex(current);
  return (
    presets.find((p) => {
      const rgb = parseCssColor(p.value);
      return rgb !== null && rgbToHex(rgb) === target;
    }) ?? null
  );
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
          if (prop.startsWith('--')) names.add(prop);
        }
      }
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

/** Read color presets from the live document's :root custom properties. */
export function readColorPresets(): ColorPreset[] {
  if (typeof document === 'undefined') return [];

  const names = collectCustomPropNames(document);
  const computed = getComputedStyle(document.documentElement);

  const vars: Record<string, string> = {};
  for (const name of names) {
    const value = computed.getPropertyValue(name).trim();
    if (value) vars[name] = value;
  }

  return parseColorPresets(vars);
}
