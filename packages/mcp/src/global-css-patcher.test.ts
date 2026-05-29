import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { StyleChange } from '@pixelagent/shared';
import { patchGlobalCssFile } from './global-css-patcher.js';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'pixelagent-gcss-'));
  await mkdir(join(dir, 'src'), { recursive: true });
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const cssPath = () => join(dir, 'src/index.css');
const writeCss = (content: string) => writeFile(cssPath(), content, 'utf-8');
const readCss = () => readFile(cssPath(), 'utf-8');
const change = (property: string, oldValue: string, newValue: string): StyleChange => ({
  property,
  oldValue,
  newValue,
});

describe('patchGlobalCssFile — pseudo-state', () => {
  it('creates a :hover rule without touching the resting rule', async () => {
    await writeCss('.btn {\n  color: black;\n  background-color: white;\n}\n');

    const res = await patchGlobalCssFile(
      dir,
      'button.btn',
      [change('background-color', 'white', 'red')],
      { state: 'hover', targetScope: 'all-instances' }
    );

    expect(res?.linesChanged.length).toBeGreaterThan(0);
    const css = await readCss();
    // Base/normal rule must be left intact — this is the bug being guarded.
    expect(css).toMatch(/\.btn\s*\{[^}]*background-color:\s*white/);
    // A dedicated :hover rule should be created for the hover edit.
    expect(css).toMatch(/\.btn:hover\s*\{[^}]*background-color:\s*red/);
  });

  it('patches an existing :hover rule in place rather than creating a duplicate', async () => {
    await writeCss('.btn {\n  color: black;\n}\n\n.btn:hover {\n  color: blue;\n}\n');

    await patchGlobalCssFile(dir, 'button.btn', [change('color', 'blue', 'green')], {
      state: 'hover',
      targetScope: 'all-instances',
    });

    const css = await readCss();
    expect(css).toMatch(/\.btn\s*\{[^}]*color:\s*black/);
    expect(css).toMatch(/\.btn:hover\s*\{[^}]*color:\s*green/);
    expect(css).not.toMatch(/color:\s*blue/);
  });

  it('patches the resting rule for the normal state', async () => {
    await writeCss('.btn {\n  color: black;\n}\n');

    await patchGlobalCssFile(dir, 'button.btn', [change('color', 'black', 'red')], {
      state: 'normal',
      targetScope: 'all-instances',
    });

    const css = await readCss();
    expect(css).toMatch(/\.btn\s*\{[^}]*color:\s*red/);
    expect(css).not.toMatch(/:hover/);
  });
});
