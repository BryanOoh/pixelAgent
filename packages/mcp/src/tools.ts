import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative, extname } from 'node:path';
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

  const lineIndex = payload.lineNumber - 1;
  let line = lines[lineIndex];

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
      // CSS inline styles can't express :hover/:focus/:active/:disabled.
      // Refuse rather than silently writing the value to the normal state,
      // which would make the element render the "hover" value at rest.
      if (payload.state !== 'normal') {
        warnings.push(
          `${payload.state} state requires a CSS class — inline style cannot express :${payload.state} for ${property}`
        );
        continue;
      }
      const result = patchInlineStyle(line, property, newValue);
      line = result.line;
      if (result.warning) warnings.push(`${result.warning} on line ${payload.lineNumber}`);
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
      styleChanges
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

  return {
    success: sourceChanged,
    patchedFile: payload.sourceFile,
    linesChanged: sourceLinesChanged,
    warnings: warnings.length > 0 ? warnings : undefined,
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
