import { relative, resolve, sep } from 'node:path';
import { parse } from '@babel/parser';
// @babel/traverse and @babel/generator ship dual CJS/ESM with interop quirks
// — grab the real callable through `.default` when present.
import _traverse from '@babel/traverse';
import _generate from '@babel/generator';
import * as t from '@babel/types';
import type { Plugin } from 'vite';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const traverse: typeof _traverse = (_traverse as any).default ?? _traverse;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const generate: typeof _generate = (_generate as any).default ?? _generate;

export const PIXELAGENT_SOURCE_ATTR = 'data-pa-src';

export interface PixelagentSourcePluginOptions {
  /** Project root used to compute relative source paths. Defaults to Vite config root. */
  projectRoot?: string;
  /**
   * File extensions to transform. Defaults to `.tsx`, `.jsx`.
   * `.ts`/`.js` are skipped — no JSX, faster builds.
   */
  include?: RegExp;
}

const DEFAULT_INCLUDE = /\.(tsx|jsx)$/;

/**
 * Dev-only Vite plugin: walks JSX opening elements and injects
 * `data-pa-src="relative/path.tsx:42"` so PixelAgent can resolve the source
 * file & line for any DOM node without relying on React fiber `_debugSource`
 * (removed in React 19).
 *
 * Production builds are never transformed (`apply: 'serve'`).
 */
export function pixelagentSourcePlugin(
  options: PixelagentSourcePluginOptions = {}
): Plugin {
  const include = options.include ?? DEFAULT_INCLUDE;
  let projectRoot = options.projectRoot ? resolve(options.projectRoot) : process.cwd();

  return {
    name: 'pixelagent-source-inject',
    apply: 'serve',
    enforce: 'pre',
    configResolved(config) {
      if (!options.projectRoot) {
        projectRoot = resolve(config.root);
      }
    },
    transform(code, id) {
      // Strip Vite query suffix (?v=, ?t=, ?import) before extension check.
      const cleanId = id.split('?')[0];
      if (!include.test(cleanId)) return null;
      if (cleanId.includes(`${sep}node_modules${sep}`) || cleanId.includes('/node_modules/')) {
        return null;
      }

      let ast;
      try {
        ast = parse(code, {
          sourceType: 'module',
          plugins: ['jsx', 'typescript'],
          errorRecovery: true,
        });
      } catch {
        return null;
      }

      const relPath = relative(projectRoot, cleanId).split(sep).join('/');
      let mutated = false;

      traverse(ast, {
        JSXOpeningElement(path) {
          const node = path.node;
          // Skip <></> fragments (parser yields JSXFragment, not JSXOpeningElement,
          // but defensive guard for unusual names).
          if (t.isJSXMemberExpression(node.name) || t.isJSXNamespacedName(node.name)) {
            // Custom components — still tag them.
          }

          // Already has data-pa-src? Don't overwrite (HMR re-runs, user-added).
          const hasOurAttr = node.attributes.some(
            (attr) =>
              t.isJSXAttribute(attr) &&
              t.isJSXIdentifier(attr.name) &&
              attr.name.name === PIXELAGENT_SOURCE_ATTR
          );
          if (hasOurAttr) return;

          const line = node.loc?.start.line;
          if (typeof line !== 'number') return;

          const value = `${relPath}:${line}`;
          node.attributes.push(
            t.jsxAttribute(
              t.jsxIdentifier(PIXELAGENT_SOURCE_ATTR),
              t.stringLiteral(value)
            )
          );
          mutated = true;
        },
      });

      if (!mutated) return null;

      const output = generate(ast, {
        retainLines: true,
        compact: false,
        sourceMaps: true,
        sourceFileName: cleanId,
      });

      return {
        code: output.code,
        map: output.map ?? null,
      };
    },
  };
}
