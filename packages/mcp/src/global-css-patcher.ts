import { readFile, readdir, writeFile } from 'node:fs/promises';
import { extname, join, relative, resolve } from 'node:path';
import type { StyleChange } from '@pixelagent/shared';
import { assertWithinProject } from './path-utils.js';
import {
  applyChangeToRuleBody,
  computeChangedLines,
  extractPrimaryClass,
  findCssRule,
} from './css-rule-utils.js';
import { cssRuleKey, type PatchContext } from './patch-context.js';

export interface GlobalCssPatchResult {
  patchedFile: string;
  linesChanged: number[];
  warnings: string[];
}

const PREFERRED_CSS_PATHS = [
  'packages/demo/src/app.css',
  'src/app.css',
  'src/index.css',
  'src/styles.css',
  'app/globals.css',
];

export async function patchGlobalCssFile(
  projectRoot: string,
  elementSelector: string,
  changes: StyleChange[],
  ctx: PatchContext = { state: 'normal', targetScope: 'all-instances' }
): Promise<GlobalCssPatchResult | null> {
  const className = extractPrimaryClass(elementSelector);
  if (!className) {
    return {
      patchedFile: '',
      linesChanged: [],
      warnings: [`STYLING_AMBIGUOUS: No class in selector "${elementSelector}"`],
    };
  }

  const cssRelPath = await findStylesheetForClass(projectRoot, className);
  if (!cssRelPath) {
    return {
      patchedFile: '',
      linesChanged: [],
      warnings: [`SOURCE_NOT_FOUND: No stylesheet rule for .${className}`],
    };
  }

  const cssAbsPath = assertWithinProject(projectRoot, cssRelPath);
  const cssContent = await readFile(cssAbsPath, 'utf-8');
  const ruleKey = cssRuleKey(className, ctx);
  const rule = resolveCssRule(cssContent, ruleKey, className);
  if (!rule) {
    return {
      patchedFile: cssRelPath,
      linesChanged: [],
      warnings: [`SOURCE_NOT_FOUND: No .${ruleKey} rule in ${cssRelPath}`],
    };
  }

  const warnings: string[] = [];
  let newBody = rule.body;

  for (const change of changes) {
    const updated = applyChangeToRuleBody(newBody, change);
    if (updated.changed) {
      newBody = updated.body;
    } else if (updated.warning) {
      warnings.push(updated.warning);
    }
  }

  const newContent =
    cssContent.slice(0, rule.start) + newBody + cssContent.slice(rule.end);

  if (newContent === cssContent) {
    return {
      patchedFile: cssRelPath,
      linesChanged: [],
      warnings,
    };
  }

  await writeFile(cssAbsPath, newContent, 'utf-8');

  return {
    patchedFile: cssRelPath,
    linesChanged: computeChangedLines(cssContent, newContent),
    warnings,
  };
}

async function findStylesheetForClass(
  projectRoot: string,
  className: string
): Promise<string | null> {
  for (const rel of PREFERRED_CSS_PATHS) {
    const hit = await fileContainsRule(projectRoot, rel, className);
    if (hit) return hit;
  }

  return walkForRule(join(projectRoot, 'packages'), className, projectRoot, 0, 4);
}

function resolveCssRule(css: string, ruleKey: string, className: string) {
  return findCssRule(css, ruleKey) ?? findCssRule(css, className);
}

async function fileContainsRule(
  projectRoot: string,
  relPath: string,
  className: string
): Promise<string | null> {
  try {
    const content = await readFile(resolve(projectRoot, relPath), 'utf-8');
    return findCssRule(content, className) ? relPath : null;
  } catch {
    return null;
  }
}

async function walkForRule(
  dir: string,
  className: string,
  projectRoot: string,
  depth: number,
  maxDepth: number
): Promise<string | null> {
  if (depth > maxDepth) return null;

  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return null;
  }

  for (const entry of entries) {
    if (
      entry.name.startsWith('.') ||
      entry.name === 'node_modules' ||
      entry.name === 'dist'
    ) {
      continue;
    }

    const full = join(dir, entry.name);

    if (entry.isDirectory()) {
      const found = await walkForRule(full, className, projectRoot, depth + 1, maxDepth);
      if (found) return found;
    } else if (entry.isFile() && extname(entry.name) === '.css' && !entry.name.endsWith('.module.css')) {
      const rel = relative(projectRoot, full);
      const hit = await fileContainsRule(projectRoot, rel, className);
      if (hit) return hit;
    }
  }

  return null;
}
