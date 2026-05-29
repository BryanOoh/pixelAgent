/**
 * CSS Modules patcher.
 *
 * Given a source line referencing `styles.X` and a style change, locates the
 * companion `.module.css` file via the import statement, then rewrites the
 * matching CSS rule in place.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import type { StyleChange } from '@pixelagent/shared';
import { assertWithinProject } from './path-utils.js';
import {
  applyChangeToRuleBody,
  computeChangedLines,
  findCssRule,
  insertStateRule,
} from './css-rule-utils.js';
import { cssRuleKey, type PatchContext } from './patch-context.js';

export interface CssModulePatchResult {
  patchedFile: string;
  linesChanged: number[];
  warnings: string[];
}

export async function patchCssModulesFile(
  projectRoot: string,
  sourceFilePath: string,
  sourceLine: string,
  changes: StyleChange[],
  ctx: PatchContext = { state: 'normal', targetScope: 'all-instances' }
): Promise<CssModulePatchResult | null> {
  const className = extractStylesReference(sourceLine);
  if (!className) {
    return {
      patchedFile: relative(projectRoot, sourceFilePath),
      linesChanged: [],
      warnings: [
        `STYLING_AMBIGUOUS: No styles.X reference found on source line`,
      ],
    };
  }

  const sourceContent = await readFile(sourceFilePath, 'utf-8');
  const importPath = findModuleCssImport(sourceContent);
  if (!importPath) {
    return {
      patchedFile: relative(projectRoot, sourceFilePath),
      linesChanged: [],
      warnings: [
        `SOURCE_NOT_FOUND: No .module.css import in ${relative(projectRoot, sourceFilePath)}`,
      ],
    };
  }

  const cssAbsPath = resolve(dirname(sourceFilePath), importPath);
  assertWithinProject(projectRoot, relative(projectRoot, cssAbsPath));

  let cssContent: string;
  try {
    cssContent = await readFile(cssAbsPath, 'utf-8');
  } catch {
    return {
      patchedFile: relative(projectRoot, cssAbsPath),
      linesChanged: [],
      warnings: [`SOURCE_NOT_FOUND: Cannot read ${importPath}`],
    };
  }

  const ruleKey = cssRuleKey(className, ctx);
  const isStateRule = ruleKey !== className;
  const rule = findCssRule(cssContent, ruleKey);

  if (rule) {
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
      return { patchedFile: relative(projectRoot, cssAbsPath), linesChanged: [], warnings };
    }

    await writeFile(cssAbsPath, newContent, 'utf-8');
    return {
      patchedFile: relative(projectRoot, cssAbsPath),
      linesChanged: computeChangedLines(cssContent, newContent),
      warnings,
    };
  }

  // No matching rule. Create a `.class:state { … }` rule for a pseudo-state
  // rather than writing into the resting rule (which would corrupt normal).
  if (isStateRule) {
    const newContent = insertStateRule(cssContent, className, ruleKey, changes);
    await writeFile(cssAbsPath, newContent, 'utf-8');
    return {
      patchedFile: relative(projectRoot, cssAbsPath),
      linesChanged: computeChangedLines(cssContent, newContent),
      warnings: [],
    };
  }

  return {
    patchedFile: relative(projectRoot, cssAbsPath),
    linesChanged: [],
    warnings: [`SOURCE_NOT_FOUND: No .${ruleKey} rule in ${importPath}`],
  };
}

function extractStylesReference(line: string): string | null {
  const dotMatch = line.match(/styles\.([A-Za-z_][\w$]*)/);
  if (dotMatch) return dotMatch[1];
  const bracketMatch = line.match(/styles\[['"]([^'"]+)['"]\]/);
  if (bracketMatch) return bracketMatch[1];
  return null;
}

function findModuleCssImport(source: string): string | null {
  const defaultImport = source.match(
    /import\s+\w+\s+from\s+['"]([^'"]+\.module\.css)['"]/
  );
  if (defaultImport) return defaultImport[1];
  const nsImport = source.match(
    /import\s+\*\s+as\s+\w+\s+from\s+['"]([^'"]+\.module\.css)['"]/
  );
  if (nsImport) return nsImport[1];
  return null;
}
