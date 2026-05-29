import type { StyleChange } from '@pixelagent/shared';

export interface RuleMatch {
  className: string;
  start: number;
  end: number;
  body: string;
}

export function findCssRule(css: string, className: string): RuleMatch | null {
  const selectorRegex = new RegExp(
    `\\.${escapeRegex(className)}(?![\\w-])\\s*\\{`,
    'g'
  );
  const m = selectorRegex.exec(css);
  if (!m) return null;

  const bodyStart = m.index;
  let depth = 0;
  let i = m.index + m[0].length - 1;
  for (; i < css.length; i++) {
    const ch = css[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        return {
          className,
          start: bodyStart,
          end: i + 1,
          body: css.slice(bodyStart, i + 1),
        };
      }
    }
  }
  return null;
}

export function applyChangeToRuleBody(
  body: string,
  change: StyleChange
): { body: string; changed: boolean; warning?: string } {
  const { property, newValue } = change;
  const escapedProp = escapeRegex(property);
  const declRegex = new RegExp(
    `(^|[;{\\s])(${escapedProp})\\s*:\\s*([^;}]+)(;?)`,
    'm'
  );
  const declMatch = body.match(declRegex);

  if (declMatch) {
    const replaced = body.replace(declRegex, (_full, lead, prop, _oldVal, semi) => {
      const trailing = semi || ';';
      return `${lead}${prop}: ${newValue}${trailing}`;
    });
    return { body: replaced, changed: replaced !== body };
  }

  const closeBraceIdx = body.lastIndexOf('}');
  if (closeBraceIdx === -1) {
    return {
      body,
      changed: false,
      warning: `PATCH_CONFLICT: malformed CSS rule for property "${property}"`,
    };
  }

  const indentMatch = body.match(/\n([ \t]+)[\w-]+\s*:/);
  const indent = indentMatch ? indentMatch[1] : '  ';
  const before = body.slice(0, closeBraceIdx).replace(/\s*$/, '');
  const newBody = `${before}\n${indent}${property}: ${newValue};\n}`;
  return { body: newBody, changed: true };
}

/**
 * Build a `.class:state { … }` block and splice it into the stylesheet —
 * right after the base class rule when present (for locality) or at end of
 * file otherwise. Used when a pseudo-state edit has no existing rule to patch;
 * creating a dedicated rule keeps the change out of the resting/normal style.
 */
export function insertStateRule(
  css: string,
  className: string,
  ruleKey: string,
  changes: StyleChange[]
): string {
  const decls = changes.map((c) => `  ${c.property}: ${c.newValue};`).join('\n');
  const block = `.${ruleKey} {\n${decls}\n}`;

  const baseRule = findCssRule(css, className);
  if (baseRule) {
    return `${css.slice(0, baseRule.end)}\n\n${block}${css.slice(baseRule.end)}`;
  }
  const sep = css.length === 0 || css.endsWith('\n') ? '\n' : '\n\n';
  return `${css}${sep}${block}\n`;
}

export function computeChangedLines(before: string, after: string): number[] {
  const beforeLines = before.split('\n');
  const afterLines = after.split('\n');
  const changed: number[] = [];
  const max = Math.max(beforeLines.length, afterLines.length);
  for (let i = 0; i < max; i++) {
    if (beforeLines[i] !== afterLines[i]) {
      changed.push(i + 1);
    }
  }
  return changed;
}

export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function extractPrimaryClass(selector: string): string | null {
  const matches = selector.match(/\.([a-zA-Z_][\w-]*)/g);
  if (!matches?.length) return null;
  return matches[matches.length - 1].slice(1);
}

/** Locate a rule inside `@media … { … }` (absolute indices in full file). */
export function findCssRuleInMedia(
  css: string,
  ruleKey: string,
  mediaQuery: string
): RuleMatch | null {
  const mediaNeedle = `@media ${mediaQuery}`;
  const mediaStart = css.indexOf(mediaNeedle);
  if (mediaStart === -1) return null;

  let depth = 0;
  let blockStart = -1;
  for (let i = mediaStart; i < css.length; i++) {
    const ch = css[i];
    if (ch === '{') {
      if (depth === 0) blockStart = i + 1;
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0 && blockStart !== -1) {
        const block = css.slice(blockStart, i);
        const inner = findCssRule(block, ruleKey);
        if (!inner) return null;
        return {
          ...inner,
          start: blockStart + inner.start,
          end: blockStart + inner.end,
        };
      }
    }
  }
  return null;
}
