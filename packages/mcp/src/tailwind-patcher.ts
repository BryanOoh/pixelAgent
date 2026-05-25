/**
 * Tailwind utility-class patcher.
 *
 * Maps a CSS property + value pair to a Tailwind utility class, then rewrites
 * the className attribute on the source line. Snaps to the default Tailwind
 * scale when the value matches a known step; falls back to arbitrary-value
 * syntax (e.g. `p-[13px]`) otherwise.
 *
 * MVP scope:
 *   - className must be a literal string ("p-4 bg-blue-500"), not a template
 *     literal or `cn()` call. Complex forms emit a warning instead of patching.
 *   - One utility per property assumed (no `p-4 px-2` reconciliation).
 */

import type { StyleChange } from '@pixelagent/shared';
import {
  prefixTailwindUtility,
  stripTailwindVariants,
  tailwindClassMatchesContext,
  type PatchContext,
} from './patch-context.js';

interface PropertyMeta {
  prefix: string;
  scale: 'spacing' | 'fontSize' | 'radius' | 'opacity' | 'color' | 'fontWeight' | 'lineHeight';
}

const PROPERTY_MAP: Record<string, PropertyMeta> = {
  padding: { prefix: 'p', scale: 'spacing' },
  'padding-top': { prefix: 'pt', scale: 'spacing' },
  'padding-right': { prefix: 'pr', scale: 'spacing' },
  'padding-bottom': { prefix: 'pb', scale: 'spacing' },
  'padding-left': { prefix: 'pl', scale: 'spacing' },
  margin: { prefix: 'm', scale: 'spacing' },
  'margin-top': { prefix: 'mt', scale: 'spacing' },
  'margin-right': { prefix: 'mr', scale: 'spacing' },
  'margin-bottom': { prefix: 'mb', scale: 'spacing' },
  'margin-left': { prefix: 'ml', scale: 'spacing' },
  width: { prefix: 'w', scale: 'spacing' },
  height: { prefix: 'h', scale: 'spacing' },
  gap: { prefix: 'gap', scale: 'spacing' },

  'font-size': { prefix: 'text', scale: 'fontSize' },
  'font-weight': { prefix: 'font', scale: 'fontWeight' },
  'line-height': { prefix: 'leading', scale: 'lineHeight' },

  'border-radius': { prefix: 'rounded', scale: 'radius' },
  opacity: { prefix: 'opacity', scale: 'opacity' },

  color: { prefix: 'text', scale: 'color' },
  'background-color': { prefix: 'bg', scale: 'color' },
  'border-color': { prefix: 'border', scale: 'color' },
};

const SPACING_SCALE: Record<string, string> = {
  '0': '0',
  '0px': '0',
  '1px': 'px',
  '2px': '0.5',
  '0.125rem': '0.5',
  '4px': '1',
  '0.25rem': '1',
  '6px': '1.5',
  '0.375rem': '1.5',
  '8px': '2',
  '0.5rem': '2',
  '10px': '2.5',
  '0.625rem': '2.5',
  '12px': '3',
  '0.75rem': '3',
  '14px': '3.5',
  '0.875rem': '3.5',
  '16px': '4',
  '1rem': '4',
  '20px': '5',
  '1.25rem': '5',
  '24px': '6',
  '1.5rem': '6',
  '28px': '7',
  '1.75rem': '7',
  '32px': '8',
  '2rem': '8',
  '40px': '10',
  '2.5rem': '10',
  '48px': '12',
  '3rem': '12',
  '64px': '16',
  '4rem': '16',
  '80px': '20',
  '96px': '24',
  '128px': '32',
};

const FONT_SIZE_SCALE: Record<string, string> = {
  '12px': 'xs',
  '0.75rem': 'xs',
  '14px': 'sm',
  '0.875rem': 'sm',
  '16px': 'base',
  '1rem': 'base',
  '18px': 'lg',
  '1.125rem': 'lg',
  '20px': 'xl',
  '1.25rem': 'xl',
  '24px': '2xl',
  '1.5rem': '2xl',
  '30px': '3xl',
  '1.875rem': '3xl',
  '36px': '4xl',
  '2.25rem': '4xl',
  '48px': '5xl',
  '3rem': '5xl',
  '60px': '6xl',
  '3.75rem': '6xl',
};

const RADIUS_SCALE: Record<string, string> = {
  '0': 'none',
  '0px': 'none',
  '2px': 'sm',
  '0.125rem': 'sm',
  '4px': '',
  '0.25rem': '',
  '6px': 'md',
  '0.375rem': 'md',
  '8px': 'lg',
  '0.5rem': 'lg',
  '12px': 'xl',
  '0.75rem': 'xl',
  '16px': '2xl',
  '1rem': '2xl',
  '24px': '3xl',
  '1.5rem': '3xl',
  '9999px': 'full',
  '999px': 'full',
};

const FONT_WEIGHT_SCALE: Record<string, string> = {
  '100': 'thin',
  '200': 'extralight',
  '300': 'light',
  '400': 'normal',
  '500': 'medium',
  '600': 'semibold',
  '700': 'bold',
  '800': 'extrabold',
  '900': 'black',
};

const LINE_HEIGHT_SCALE: Record<string, string> = {
  '1': 'none',
  '1.25': 'tight',
  '1.375': 'snug',
  '1.5': 'normal',
  '1.625': 'relaxed',
  '2': 'loose',
};

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '');
}

function lookupScale(scale: PropertyMeta['scale'], value: string): string | null {
  const v = normalize(value);
  switch (scale) {
    case 'spacing':
      return SPACING_SCALE[v] ?? null;
    case 'fontSize':
      return FONT_SIZE_SCALE[v] ?? null;
    case 'radius':
      return RADIUS_SCALE[v] ?? null;
    case 'fontWeight':
      return FONT_WEIGHT_SCALE[v] ?? null;
    case 'lineHeight':
      return LINE_HEIGHT_SCALE[v] ?? null;
    case 'opacity': {
      const num = Number(v);
      if (!Number.isFinite(num)) return null;
      const pct = Math.round(num * 100);
      // Tailwind opacity scale steps every 5
      if (pct % 5 === 0 && pct >= 0 && pct <= 100) return String(pct);
      return null;
    }
    case 'color':
      return null; // always use arbitrary value for colors
  }
}

export function toTailwindClass(property: string, value: string): string | null {
  const meta = PROPERTY_MAP[property];
  if (!meta) return null;

  const scaled = lookupScale(meta.scale, value);
  if (scaled !== null) {
    return scaled === '' ? meta.prefix : `${meta.prefix}-${scaled}`;
  }

  // Arbitrary value fallback: bg-[#fff], p-[13px], text-[2.1rem]
  const arbValue = value.trim().replace(/\s+/g, '_');
  return `${meta.prefix}-[${arbValue}]`;
}

const FONT_SIZE_TOKENS = new Set([
  'xs', 'sm', 'base', 'lg', 'xl',
  '2xl', '3xl', '4xl', '5xl', '6xl', '7xl', '8xl', '9xl',
]);

const RADIUS_TOKENS = new Set([
  'none', 'sm', '', 'md', 'lg', 'xl', '2xl', '3xl', 'full',
]);

const FONT_WEIGHT_TOKENS = new Set([
  'thin', 'extralight', 'light', 'normal', 'medium',
  'semibold', 'bold', 'extrabold', 'black',
]);

const LINE_HEIGHT_TOKENS = new Set([
  'none', 'tight', 'snug', 'normal', 'relaxed', 'loose',
]);

const SIZE_KEYWORDS = new Set([
  'auto', 'full', 'screen', 'min', 'max', 'fit',
  'px', '0',
]);

/**
 * Should a given Tailwind class be removed when patching `property`?
 * Precise per-property matchers so e.g. patching `font-size` doesn't strip
 * `text-blue-500` (a color utility that shares the `text-` prefix).
 */
function shouldRemove(cls: string, property: string): boolean {
  const colorClass = (prefix: string): boolean => {
    const m = cls.match(new RegExp(`^${prefix}-(.+)$`));
    if (!m) return false;
    if (FONT_SIZE_TOKENS.has(m[1])) return false; // ambiguity guard
    if (/^\[[^\]]+\]$/.test(m[1])) {
      // Arbitrary value: classify as color only if it doesn't look like a length
      const arb = m[1].slice(1, -1);
      return !/(px|rem|em|%|vh|vw)$/.test(arb);
    }
    return /^[a-z]+(-\d+)?$/.test(m[1]); // red-500, white, current
  };

  const spacingClass = (prefix: string): boolean => {
    const m = cls.match(new RegExp(`^${prefix}-(.+)$`));
    if (!m) return false;
    if (SIZE_KEYWORDS.has(m[1])) return true;
    if (/^\d+(\.\d+)?$/.test(m[1])) return true;
    if (/^\[[^\]]+\]$/.test(m[1])) return true;
    return false;
  };

  switch (property) {
    case 'padding': return spacingClass('p');
    case 'padding-top': return spacingClass('pt');
    case 'padding-right': return spacingClass('pr');
    case 'padding-bottom': return spacingClass('pb');
    case 'padding-left': return spacingClass('pl');
    case 'margin': return spacingClass('m');
    case 'margin-top': return spacingClass('mt');
    case 'margin-right': return spacingClass('mr');
    case 'margin-bottom': return spacingClass('mb');
    case 'margin-left': return spacingClass('ml');
    case 'width': return spacingClass('w');
    case 'height': return spacingClass('h');
    case 'gap': return spacingClass('gap');

    case 'font-size': {
      const m = cls.match(/^text-(.+)$/);
      if (!m) return false;
      if (FONT_SIZE_TOKENS.has(m[1])) return true;
      if (/^\[[\d.]+(px|rem|em|%)\]$/.test(m[1])) return true;
      return false;
    }
    case 'font-weight': {
      const m = cls.match(/^font-(.+)$/);
      if (!m) return false;
      if (FONT_WEIGHT_TOKENS.has(m[1])) return true;
      if (/^\d+$/.test(m[1])) return true;
      if (/^\[[^\]]+\]$/.test(m[1])) return true;
      return false;
    }
    case 'line-height': {
      const m = cls.match(/^leading-(.+)$/);
      if (!m) return false;
      if (LINE_HEIGHT_TOKENS.has(m[1])) return true;
      if (/^\d+(\.\d+)?$/.test(m[1])) return true;
      if (/^\[[^\]]+\]$/.test(m[1])) return true;
      return false;
    }
    case 'border-radius': {
      if (cls === 'rounded') return true;
      const m = cls.match(/^rounded-(.+)$/);
      if (!m) return false;
      if (RADIUS_TOKENS.has(m[1])) return true;
      if (/^\[[^\]]+\]$/.test(m[1])) return true;
      return false;
    }
    case 'opacity': {
      const m = cls.match(/^opacity-(.+)$/);
      if (!m) return false;
      if (/^\d+$/.test(m[1])) return true;
      if (/^\[[^\]]+\]$/.test(m[1])) return true;
      return false;
    }
    case 'color': return colorClass('text');
    case 'background-color': return colorClass('bg');
    case 'border-color': return colorClass('border');
    default: return false;
  }
}

export interface TailwindPatchResult {
  line: string;
  changed: boolean;
  warning?: string;
}

/**
 * Replace utilities matching `change.property`'s Tailwind footprint on `line`,
 * inserting the new utility for `newValue`. Leaves all other classes alone.
 */
export function patchTailwindLine(
  line: string,
  change: StyleChange,
  ctx?: PatchContext
): TailwindPatchResult {
  if (!PROPERTY_MAP[change.property]) {
    return {
      line,
      changed: false,
      warning: `STYLING_AMBIGUOUS: No Tailwind mapping for "${change.property}"`,
    };
  }

  const baseClass = toTailwindClass(change.property, change.newValue);
  if (!baseClass) {
    return {
      line,
      changed: false,
      warning: `STYLING_AMBIGUOUS: Could not compute Tailwind class for ${change.property}: ${change.newValue}`,
    };
  }

  // Find className= or class= with literal string value (single OR double quoted).
  const literalRegex = /\b(className|class)\s*=\s*(["'])([^"']*)\2/;
  const literalMatch = line.match(literalRegex);

  if (!literalMatch) {
    if (/\b(className|class)\s*=\s*\{/.test(line)) {
      return {
        line,
        changed: false,
        warning: `STYLING_AMBIGUOUS: className uses a JS expression; literal string patcher cannot edit it safely`,
      };
    }
    return {
      line,
      changed: false,
      warning: `STYLING_AMBIGUOUS: No className attribute on line`,
    };
  }

  const [, attr, quote, classStr] = literalMatch;
  const classes = classStr.split(/\s+/).filter(Boolean);
  const patchCtx = ctx ?? { state: 'normal', targetScope: 'all-instances' };
  const newClass = prefixTailwindUtility(baseClass, patchCtx);
  const filtered = classes.filter((c) => {
    if (ctx && !tailwindClassMatchesContext(c, patchCtx)) {
      return true;
    }
    return !shouldRemove(stripTailwindVariants(c), change.property);
  });
  filtered.push(newClass);

  const newClassStr = filtered.join(' ');
  return {
    line: line.replace(
      literalRegex,
      `${attr}=${quote}${newClassStr}${quote}`
    ),
    changed: true,
  };
}
