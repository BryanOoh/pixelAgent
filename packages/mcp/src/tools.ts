import { readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join, relative } from 'node:path';
import type {
  ApplyPayload,
  ApplyVisualDiffResult,
  DesignTokens,
  ResolveElementResult,
  StyleChange,
} from '@pixelagent/shared';
import { assertWithinProject } from './path-utils.js';
import { patchTailwindLine } from './tailwind-patcher.js';
import type { PatchContext } from './patch-context.js';
import { patchCssModulesFile } from './css-modules-patcher.js';
import { patchGlobalCssFile } from './global-css-patcher.js';
import { computeChangedLines, escapeRegex } from './css-rule-utils.js';

export { assertWithinProject } from './path-utils.js';

export async function applyVisualDiff(
  projectRoot: string,
  payload: ApplyPayload
): Promise<ApplyVisualDiffResult> {
  if (!payload.sourceFile) {
    throw new Error('SOURCE_NOT_FOUND: No source file in payload');
  }

  const filePath = assertWithinProject(projectRoot, payload.sourceFile);
  const content = await readFile(filePath, 'utf-8');
  let lines = content.split('\n');
  const warnings: string[] = [];

  if (!payload.lineNumber || payload.lineNumber <= 0 || payload.lineNumber > lines.length) {
    throw new Error(`PATCH_CONFLICT: Cannot patch line ${payload.lineNumber ?? 'unknown'}`);
  }

  let lineIndex = payload.lineNumber - 1;
  let line = lines[lineIndex];

  const sidecarFiles = new Set<string>();

  const patchCtx: PatchContext = {
    state: payload.state,
    targetScope: payload.targetScope,
  };

  // Group changes so we can defer CSS-module work — those touch a separate file.
  const styleChanges: StyleChange[] = [];

  for (const change of payload.changes) {
    const { property, oldValue, newValue } = change;

    if (property === 'textContent' || property === 'text') {
      const result = patchTextContentInFile(lines, oldValue, newValue);
      if (result.changed) {
        lines = result.lines;
        line = lines[lineIndex] ?? line;
      } else if (result.warning) {
        warnings.push(`${result.warning} (source ${payload.sourceFile})`);
      }
      continue;
    }

    if (property === 'value') {
      const result = patchValueAttribute(line, newValue);
      line = result.line;
      if (result.warning) warnings.push(`${result.warning} on line ${payload.lineNumber}`);
      continue;
    }

    if (payload.stylingSystem === 'inline') {
      if (payload.state !== 'normal') {
        // Inline can't express :hover/:focus/etc., so route the change to a
        // sibling sidecar CSS file and attach a stable class to the element.
        const existing = findExistingPaClass(line);
        const className = existing ?? generatePaClassName(payload.sourceFile, lines);

        if (!existing) {
          const classResult = addClassNameToJsxLine(line, className);
          if (classResult.warning) {
            warnings.push(`${classResult.warning} on line ${lineIndex + 1}`);
            continue;
          }
          line = classResult.line;
        }

        const importAdded = ensureSidecarImport(lines, `./${SIDECAR_FILENAME}`);
        if (importAdded) {
          // Source line just shifted down by one; keep our cursor on the
          // element so subsequent changes patch the right row.
          lineIndex += 1;
        }

        const sidecarPath = join(dirname(filePath), SIDECAR_FILENAME);
        await upsertStateCssRule(sidecarPath, className, payload.state, property, newValue);
        sidecarFiles.add(sidecarPath);
        continue;
      }
      const result = patchInlineStyle(line, property, newValue);
      line = result.line;
      if (result.warning) warnings.push(`${result.warning} on line ${lineIndex + 1}`);
      continue;
    }

    if (payload.stylingSystem === 'tailwind' && payload.targetScope === 'this-instance') {
      const inline = patchInlineStyle(line, property, newValue);
      if (!inline.warning) {
        line = inline.line;
        continue;
      }
      warnings.push(
        `targetScope this-instance: no inline style on line ${payload.lineNumber} — ${inline.warning}`
      );
    }

    if (payload.stylingSystem === 'tailwind') {
      const result = patchTailwindLine(line, change, patchCtx);
      line = result.line;
      if (result.warning) warnings.push(result.warning);
      continue;
    }

    if (
      payload.stylingSystem === 'css-modules' ||
      payload.stylingSystem === 'global-css'
    ) {
      styleChanges.push(change);
      continue;
    }
  }

  if (line !== lines[lineIndex]) {
    lines[lineIndex] = line;
  }

  const newContent = lines.join('\n');
  const sourceChanged = newContent !== content;
  if (sourceChanged) {
    await writeFile(filePath, newContent, 'utf-8');
  }

  const sourceLinesChanged = sourceChanged
    ? computeChangedLines(content, newContent)
    : [];

  if (payload.stylingSystem === 'css-modules' && styleChanges.length > 0) {
    const cssResult = await patchCssModulesFile(
      projectRoot,
      filePath,
      line,
      styleChanges,
      patchCtx
    );
    if (cssResult) {
      warnings.push(...cssResult.warnings);
      return {
        success: cssResult.linesChanged.length > 0 || sourceChanged,
        patchedFile: cssResult.patchedFile,
        linesChanged: cssResult.linesChanged,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    }
  }

  if (payload.stylingSystem === 'global-css' && styleChanges.length > 0) {
    const cssResult = await patchGlobalCssFile(
      projectRoot,
      payload.elementSelector,
      styleChanges,
      patchCtx
    );
    if (cssResult) {
      warnings.push(...cssResult.warnings);
      return {
        success: cssResult.linesChanged.length > 0 || sourceChanged,
        patchedFile: cssResult.patchedFile,
        linesChanged: cssResult.linesChanged,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    }
  }

  const sidecarUsed = sidecarFiles.size > 0;
  return {
    success: sourceChanged || sidecarUsed,
    patchedFile: payload.sourceFile,
    linesChanged: sourceLinesChanged.length > 0 ? sourceLinesChanged : sidecarUsed ? [lineIndex + 1] : [],
    warnings: warnings.length > 0 ? warnings : undefined,
    sidecarFiles: sidecarUsed ? Array.from(sidecarFiles) : undefined,
  };
}

function patchTextContentInFile(
  lines: string[],
  oldValue: string,
  newValue: string
): { lines: string[]; changed: boolean; warning?: string } {
  const content = lines.join('\n');

  if (content.includes(oldValue)) {
    const next = content.replace(oldValue, newValue);
    if (next !== content) {
      return { lines: next.split('\n'), changed: true };
    }
  }

  const flexible = new RegExp(escapeRegex(oldValue.trim()).replace(/\s+/g, '\\s+'));
  const match = flexible.exec(content);
  if (match) {
    const next =
      content.slice(0, match.index) + newValue + content.slice(match.index + match[0].length);
    return { lines: next.split('\n'), changed: true };
  }

  for (let i = 0; i < lines.length; i++) {
    const single = patchTextContent(lines[i], oldValue, newValue);
    if (single.line !== lines[i]) {
      const nextLines = [...lines];
      nextLines[i] = single.line;
      return { lines: nextLines, changed: true };
    }
  }

  return { lines, changed: false, warning: `Could not locate text "${oldValue}"` };
}

function patchTextContent(
  line: string,
  oldValue: string,
  newValue: string
): { line: string; warning?: string } {
  const escapedOld = oldValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (line.includes(oldValue)) {
    return { line: line.replace(oldValue, newValue) };
  }
  if (new RegExp(`>\\s*${escapedOld}\\s*<`).test(line)) {
    return {
      line: line.replace(new RegExp(`>\\s*${escapedOld}\\s*<`), `>${newValue}<`),
    };
  }
  if (/>[^<]+</.test(line)) {
    return { line: line.replace(/>[^<]+</, `>${newValue}<`) };
  }
  return { line, warning: `Could not locate text "${oldValue}"` };
}

function patchValueAttribute(
  line: string,
  newValue: string
): { line: string; warning?: string } {
  if (/value=\{['"][^'"]*['"]\}/.test(line)) {
    return { line: line.replace(/value=\{['"][^'"]*['"]\}/, `value="${newValue}"`) };
  }
  if (/value="[^"]*"/.test(line)) {
    return { line: line.replace(/value="[^"]*"/, `value="${newValue}"`) };
  }
  return { line, warning: `Could not locate value attribute` };
}

// ── Inline + pseudo-state via sidecar CSS file ──────────────────────────
//
// Inline `style={{}}` can't express :hover/:focus/:active/:disabled. To make
// state edits land in source, we:
//   1. Generate (or reuse) a stable `pa-<basename>-<line>` className on the JSX tag.
//   2. Ensure `pixelagent-styles.css` exists as a sibling of the source file
//      and is imported from it.
//   3. Upsert a CSS rule `.pa-...:state { property: value; }` in that sidecar.
// Subsequent Applies on the same element reuse the existing `pa-*` class so
// new properties get added to the same rule instead of orphaning the old one.

const SIDECAR_FILENAME = 'pixelagent-styles.css';

const PA_CLASS_RE = /\bpa-[A-Za-z0-9_-]+\b/g;

/**
 * Pick the smallest `pa-<basename>-<n>` slot not already used anywhere in the
 * source file. Line-number-based names collide when imports shift content
 * (e.g. first Apply on line 7 takes `pa-App-7`, the same line later refers to
 * a different element). Scanning the whole file guarantees uniqueness.
 */
export function generatePaClassName(sourceFile: string, lines: string[]): string {
  const base = basename(sourceFile, extname(sourceFile)).replace(/[^A-Za-z0-9_-]/g, '') || 'el';
  const used = new Set<string>();
  for (const line of lines) {
    const matches = line.match(PA_CLASS_RE);
    if (matches) for (const m of matches) used.add(m);
  }
  let n = 1;
  while (used.has(`pa-${base}-${n}`)) n++;
  return `pa-${base}-${n}`;
}

export function findExistingPaClass(line: string): string | null {
  const m = line.match(/className\s*=\s*"([^"]*)"/);
  if (!m) return null;
  return m[1].split(/\s+/).find((c) => c.startsWith('pa-')) ?? null;
}

export function addClassNameToJsxLine(
  line: string,
  className: string
): { line: string; warning?: string } {
  const strClassRegex = /className\s*=\s*"([^"]*)"/;
  if (strClassRegex.test(line)) {
    return {
      line: line.replace(strClassRegex, (m, existing) => {
        const classes = existing.split(/\s+/).filter(Boolean);
        if (classes.includes(className)) return m;
        return `className="${[...classes, className].join(' ')}"`;
      }),
    };
  }

  if (/className\s*=\s*\{/.test(line)) {
    return {
      line,
      warning: `Cannot inject className into dynamic className={...}`,
    };
  }

  const tagRegex = /<([A-Za-z][\w.]*)\b/;
  if (!tagRegex.test(line)) {
    return { line, warning: `No JSX tag found on line for className injection` };
  }
  return {
    line: line.replace(tagRegex, (_m, tag) => `<${tag} className="${className}"`),
  };
}

/** Insert an import after the existing import block. Returns true if the line was inserted. */
export function ensureSidecarImport(lines: string[], importPath: string): boolean {
  const needle = `'${importPath}'`;
  if (lines.some((l) => l.includes(needle))) return false;

  let lastImportIdx = -1;
  for (let i = 0; i < Math.min(lines.length, 80); i++) {
    const l = lines[i];
    if (/^\s*import\s/.test(l)) lastImportIdx = i;
  }
  const insertIdx = lastImportIdx + 1;
  lines.splice(insertIdx, 0, `import '${importPath}';`);
  return true;
}

async function upsertStateCssRule(
  cssFilePath: string,
  className: string,
  state: string,
  property: string,
  newValue: string
): Promise<void> {
  let content: string;
  try {
    content = await readFile(cssFilePath, 'utf-8');
  } catch {
    content = '/* PixelAgent generated styles — do not edit by hand. */\n';
  }

  const selector = `.${className}:${state}`;
  const ruleRegex = new RegExp(
    `(\\.${escapeRegex(className)}:${state}\\s*\\{)([\\s\\S]*?)(\\})`,
    'm'
  );

  // !important so the :state rule wins over the element's normal-state
  // inline style. Inline (specificity 1,0,0,0) would otherwise beat
  // `.cls:state` (0,2,0) and the hover edit would visibly do nothing.
  const declaration = `${property}: ${newValue} !important`;

  const match = content.match(ruleRegex);
  if (match) {
    const inner = match[2];
    const propRegex = new RegExp(`(\\s*${escapeRegex(property)}\\s*:\\s*)[^;]+;?`);
    let nextInner: string;
    if (propRegex.test(inner)) {
      nextInner = inner.replace(propRegex, `$1${newValue} !important;`);
    } else {
      const trimmed = inner.replace(/\s+$/, '');
      const lead = trimmed.endsWith(';') || trimmed === '' ? '' : ';';
      nextInner = `${trimmed}${lead}\n  ${declaration};\n`;
    }
    content = content.replace(ruleRegex, `$1${nextInner}$3`);
  } else {
    if (!content.endsWith('\n')) content += '\n';
    content += `\n${selector} {\n  ${declaration};\n}\n`;
  }

  await writeFile(cssFilePath, content, 'utf-8');
}

export function patchInlineStyle(
  line: string,
  property: string,
  newValue: string
): { line: string; warning?: string } {
  const camel = property.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
  const styleRegex = /style=\{\{([^}]*)\}\}/;

  // Existing style block: update or append the property in place.
  if (styleRegex.test(line)) {
    const updated = line.replace(styleRegex, (_match, inner) => {
      const trimmed = inner.trim();
      if (trimmed.includes(`${camel}:`)) {
        return `style={{${trimmed.replace(
          new RegExp(`${camel}:\\s*['"][^'"]*['"]`),
          `${camel}: '${newValue}'`
        )}}}`;
      }
      const separator = trimmed ? `${trimmed}, ` : '';
      return `style={{${separator}${camel}: '${newValue}'}}`;
    });
    return { line: updated };
  }

  // No style block — inject one into the JSX opening tag on this line.
  // Matches `<Tag ...>` or `<Tag ... />` so we can splice the attribute in
  // before the closing `>`, preserving self-closing form.
  const tagRegex = /<([A-Za-z][\w.]*)\b([^>]*?)(\s*\/?)>/;
  if (tagRegex.test(line)) {
    const updated = line.replace(
      tagRegex,
      (_m, tag, attrs, close) => `<${tag}${attrs} style={{ ${camel}: '${newValue}' }}${close}>`
    );
    return { line: updated };
  }

  return { line, warning: `Could not locate JSX tag for ${property} on this line` };
}

async function findInSourceFiles(
  projectRoot: string,
  searchTerm: string
): Promise<{ file: string; line: number } | null> {
  const sourceExtensions = new Set(['.tsx', '.jsx', '.ts', '.js']);

  async function walk(dir: string): Promise<{ file: string; line: number } | null> {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return null;
    }

    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') {
        continue;
      }

      const full = join(dir, entry.name);

      if (entry.isDirectory()) {
        const found = await walk(full);
        if (found) return found;
      } else if (sourceExtensions.has(extname(entry.name))) {
        const content = await readFile(full, 'utf-8');
        if (content.includes(searchTerm)) {
          const lineNumber = content.split('\n').findIndex((l) => l.includes(searchTerm)) + 1;
          return { file: relative(projectRoot, full), line: lineNumber };
        }
      }
    }

    return null;
  }

  return walk(projectRoot);
}

export async function resolveElement(
  projectRoot: string,
  selector: string
): Promise<ResolveElementResult> {
  const classMatch = selector.match(/\.([a-zA-Z0-9_-]+)/);
  if (!classMatch) {
    return {
      sourceFile: null,
      lineNumber: null,
      componentName: null,
      confidence: 'low',
      method: 'heuristic',
    };
  }

  const match = await findInSourceFiles(projectRoot, classMatch[1]);
  if (match) {
    return {
      sourceFile: match.file,
      lineNumber: match.line,
      componentName: null,
      confidence: 'medium',
      method: 'heuristic',
    };
  }

  return {
    sourceFile: null,
    lineNumber: null,
    componentName: null,
    confidence: 'low',
    method: 'heuristic',
  };
}

export async function getDesignTokens(projectRoot: string): Promise<DesignTokens> {
  const tokens: DesignTokens = {};
  const { resolve } = await import('node:path');
  const { readFile } = await import('node:fs/promises');

  for (const configName of ['tailwind.config.js', 'tailwind.config.ts', 'tailwind.config.mjs']) {
    try {
      await readFile(resolve(projectRoot, configName), 'utf-8');
      tokens.tailwindConfig = { detected: true, path: configName };
      break;
    } catch {
      // try next
    }
  }

  for (const cssPath of ['src/index.css', 'src/app/globals.css', 'app/globals.css']) {
    try {
      const css = await readFile(resolve(projectRoot, cssPath), 'utf-8');
      const variables: Record<string, string> = {};
      const varRegex = /--([a-zA-Z0-9-]+)\s*:\s*([^;]+);/g;
      let m;
      while ((m = varRegex.exec(css)) !== null) {
        variables[`--${m[1]}`] = m[2].trim();
      }
      if (Object.keys(variables).length > 0) {
        tokens.cssVariables = variables;
      }
      break;
    } catch {
      // try next
    }
  }

  return tokens;
}
