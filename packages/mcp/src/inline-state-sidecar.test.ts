import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { ApplyPayload } from '@pixelagent/shared';
import {
  addClassNameToJsxLine,
  applyVisualDiff,
  ensureSidecarImport,
  findExistingPaClass,
  generatePaClassName,
} from './tools.js';

describe('inline + state helpers', () => {
  describe('generatePaClassName', () => {
    it('picks the first unused slot in the file', () => {
      expect(generatePaClassName('src/App.tsx', ['<p>'])).toBe('pa-App-1');
    });
    it('skips classes already in use to avoid collisions on shifted lines', () => {
      const lines = [
        `<h1 className="pa-App-1">`,
        `<p className="pa-App-2">`,
      ];
      expect(generatePaClassName('src/App.tsx', lines)).toBe('pa-App-3');
    });
    it('sanitizes basenames', () => {
      expect(generatePaClassName('src/My File.tsx', [])).toBe('pa-MyFile-1');
    });
  });

  describe('findExistingPaClass', () => {
    it('returns the pa-* class when present', () => {
      expect(findExistingPaClass(`  <p className="foo pa-App-8 bar">`)).toBe('pa-App-8');
    });
    it('returns null when absent', () => {
      expect(findExistingPaClass(`  <p className="foo bar">`)).toBeNull();
      expect(findExistingPaClass(`  <p style={{}}>`)).toBeNull();
    });
  });

  describe('addClassNameToJsxLine', () => {
    it('appends to an existing string className', () => {
      const out = addClassNameToJsxLine(`  <p className="foo">Hello</p>`, 'pa-App-8');
      expect(out.warning).toBeUndefined();
      expect(out.line).toContain(`className="foo pa-App-8"`);
    });
    it('does not duplicate an already-present class', () => {
      const out = addClassNameToJsxLine(
        `  <p className="foo pa-App-8">Hello</p>`,
        'pa-App-8'
      );
      expect(out.line).toContain(`className="foo pa-App-8"`);
      // No duplication
      expect(out.line.match(/pa-App-8/g)?.length).toBe(1);
    });
    it('injects className when none exists', () => {
      const out = addClassNameToJsxLine(`  <p>Hello</p>`, 'pa-App-8');
      expect(out.line).toBe(`  <p className="pa-App-8">Hello</p>`);
    });
    it('warns for dynamic className={expr}', () => {
      const out = addClassNameToJsxLine(`  <p className={x}>Hello</p>`, 'pa-App-8');
      expect(out.warning).toBeDefined();
    });
  });

  describe('ensureSidecarImport', () => {
    it('inserts after the last import block', () => {
      const lines = [
        `import React from 'react';`,
        `import './app.css';`,
        ``,
        `export function App() {`,
        `  return <p>Hello</p>;`,
        `}`,
      ];
      const inserted = ensureSidecarImport(lines, './pixelagent-styles.css');
      expect(inserted).toBe(true);
      expect(lines[2]).toBe(`import './pixelagent-styles.css';`);
      expect(lines[3]).toBe(``);
    });
    it('is idempotent when import is already present', () => {
      const lines = [
        `import './pixelagent-styles.css';`,
        ``,
        `export function App() {}`,
      ];
      const before = [...lines];
      const inserted = ensureSidecarImport(lines, './pixelagent-styles.css');
      expect(inserted).toBe(false);
      expect(lines).toEqual(before);
    });
  });
});

describe('applyVisualDiff (inline + state)', () => {
  let dir: string;

  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  it('creates sidecar CSS, adds import, adds className, writes :hover rule', async () => {
    dir = await mkdtemp(join(tmpdir(), 'pixelagent-state-'));
    const srcDir = join(dir, 'src');
    await writeFile(join(dir, 'package.json'), '{}', 'utf-8');
    const srcFile = 'src/App.tsx';
    const srcAbs = join(dir, srcFile);
    await import('node:fs/promises').then((fs) => fs.mkdir(srcDir, { recursive: true }));
    const before = [
      `import { useState } from 'react';`,
      ``,
      `export default function App() {`,
      `  return (`,
      `    <p style={{ color: 'blue' }}>Hello</p>`,
      `  );`,
      `}`,
    ].join('\n');
    await writeFile(srcAbs, before, 'utf-8');

    const payload: ApplyPayload = {
      schemaVersion: 1,
      elementSelector: 'p',
      sourceFile: srcFile,
      lineNumber: 5,
      targetScope: 'this-instance',
      state: 'hover',
      stylingSystem: 'inline',
      changes: [{ property: 'color', oldValue: 'rgb(0,0,255)', newValue: 'red' }],
    };

    const result = await applyVisualDiff(dir, payload);

    expect(result.success).toBe(true);

    const after = await readFile(srcAbs, 'utf-8');
    expect(after).toMatch(/import '\.\/pixelagent-styles\.css';/);
    expect(after).toMatch(/<p className="pa-App-\d+" style=/);

    const css = await readFile(resolve(srcDir, 'pixelagent-styles.css'), 'utf-8');
    expect(css).toMatch(/\.pa-App-\d+:hover\s*\{[^}]*color:\s*red\s*!important[^}]*\}/);
  });

  it('reuses an existing pa-* className on re-apply and merges properties into the same rule', async () => {
    dir = await mkdtemp(join(tmpdir(), 'pixelagent-state-'));
    const srcDir = join(dir, 'src');
    await writeFile(join(dir, 'package.json'), '{}', 'utf-8');
    const srcFile = 'src/App.tsx';
    const srcAbs = join(dir, srcFile);
    await import('node:fs/promises').then((fs) => fs.mkdir(srcDir, { recursive: true }));
    const before = [
      `import './pixelagent-styles.css';`,
      ``,
      `export default function App() {`,
      `  return (`,
      `    <p className="pa-App-5" style={{ color: 'blue' }}>Hello</p>`,
      `  );`,
      `}`,
    ].join('\n');
    await writeFile(srcAbs, before, 'utf-8');
    await writeFile(
      resolve(srcDir, 'pixelagent-styles.css'),
      `.pa-App-5:hover {\n  color: red !important;\n}\n`,
      'utf-8'
    );

    const payload: ApplyPayload = {
      schemaVersion: 1,
      elementSelector: 'p',
      sourceFile: srcFile,
      lineNumber: 5,
      targetScope: 'this-instance',
      state: 'hover',
      stylingSystem: 'inline',
      changes: [
        { property: 'background-color', oldValue: 'transparent', newValue: 'yellow' },
      ],
    };

    const result = await applyVisualDiff(dir, payload);
    expect(result.success).toBe(true);

    // Source line should NOT have a duplicate className.
    const after = await readFile(srcAbs, 'utf-8');
    expect(after.match(/pa-App-5/g)?.length).toBe(1);

    // CSS should now contain both color and background-color in the same :hover rule.
    const css = await readFile(resolve(srcDir, 'pixelagent-styles.css'), 'utf-8');
    expect(css).toMatch(/\.pa-App-5:hover\s*\{[\s\S]*color:\s*red\s*!important/);
    expect(css).toMatch(/\.pa-App-5:hover\s*\{[\s\S]*background-color:\s*yellow\s*!important/);
  });
});
