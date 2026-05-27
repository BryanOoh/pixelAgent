import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import type { ApplyPayload } from '@pixelagent/shared';
import { applyVisualDiff } from './tools.js';

const projectRoot = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const demoCssPath = resolve(projectRoot, 'packages/demo/src/app.css');

const ORIGINAL_SNAPSHOT = await readFile(demoCssPath, 'utf-8');

afterEach(async () => {
  await writeFile(demoCssPath, ORIGINAL_SNAPSHOT, 'utf-8');
});

describe('applyVisualDiff (demo global-css)', () => {
  it('patches .site-hero-lead font-size in app.css', async () => {
    const payload: ApplyPayload = {
      schemaVersion: 1,
      elementSelector: 'p.site-hero-lead',
      sourceFile: 'packages/demo/src/App.tsx',
      lineNumber: 69,
      targetScope: 'this-instance',
      state: 'normal',
      stylingSystem: 'global-css',
      changes: [
        {
          property: 'font-size',
          oldValue: '18px',
          newValue: '20px',
        },
      ],
    };

    const result = await applyVisualDiff(projectRoot, payload);

    expect(result.success).toBe(true);
    expect(result.patchedFile).toBe('packages/demo/src/app.css');
    expect(result.linesChanged.length).toBeGreaterThan(0);

    const css = await readFile(demoCssPath, 'utf-8');
    expect(css).toMatch(/\.site-hero-lead\s*\{[^}]*font-size:\s*20px/);
  });

  it('patches hero lead text in App.tsx', async () => {
    const appPath = resolve(projectRoot, 'packages/demo/src/App.tsx');
    const originalApp = await readFile(appPath, 'utf-8');

    try {
      const payload: ApplyPayload = {
        schemaVersion: 1,
        elementSelector: 'p.site-hero-lead',
        sourceFile: 'packages/demo/src/App.tsx',
        lineNumber: 69,
        targetScope: 'this-instance',
        state: 'normal',
        stylingSystem: 'global-css',
        changes: [
          {
            property: 'textContent',
            oldValue:
              'PixelAgent is a live DOM layer for vibe coders — annotate elements, tweak styles in place, and ship one structured diff to your agent. No screenshots. No round-trips.',
            newValue: 'PixelAgent patches your running app with surgical diffs.',
          },
        ],
      };

      const result = await applyVisualDiff(projectRoot, payload);
      expect(result.success).toBe(true);

      const app = await readFile(appPath, 'utf-8');
      expect(app).toContain('PixelAgent patches your running app');
    } finally {
      await writeFile(appPath, originalApp, 'utf-8');
    }
  });

  it('refuses to write inline-style changes for non-normal states', async () => {
    const appPath = resolve(projectRoot, 'packages/demo/src/App.tsx');
    const originalApp = await readFile(appPath, 'utf-8');

    try {
      const payload: ApplyPayload = {
        schemaVersion: 1,
        elementSelector: 'button.site-btn',
        sourceFile: 'packages/demo/src/App.tsx',
        lineNumber: 69,
        targetScope: 'this-instance',
        state: 'hover',
        stylingSystem: 'inline',
        changes: [{ property: 'color', oldValue: 'rgb(0,0,0)', newValue: 'red' }],
      };

      const result = await applyVisualDiff(projectRoot, payload);

      // Nothing should land on disk — :hover can't be expressed inline.
      const app = await readFile(appPath, 'utf-8');
      expect(app).toBe(originalApp);
      expect(result.linesChanged).toHaveLength(0);
      expect(result.warnings?.some((w) => w.includes('hover'))).toBe(true);
    } finally {
      await writeFile(appPath, originalApp, 'utf-8');
    }
  });
});
