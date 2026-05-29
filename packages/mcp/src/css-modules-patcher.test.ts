import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { StyleChange } from '@pixelagent/shared';
import { patchCssModulesFile } from './css-modules-patcher.js';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'pixelagent-cssmod-'));
  await mkdir(join(dir, 'src'), { recursive: true });
  await writeFile(
    join(dir, 'src/Comp.tsx'),
    "import styles from './Comp.module.css';\nexport const C = () => <button className={styles.btn}>Hi</button>;\n",
    'utf-8'
  );
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const srcPath = () => join(dir, 'src/Comp.tsx');
const cssPath = () => join(dir, 'src/Comp.module.css');
const writeCss = (content: string) => writeFile(cssPath(), content, 'utf-8');
const readCss = () => readFile(cssPath(), 'utf-8');
const line = 'export const C = () => <button className={styles.btn}>Hi</button>;';
const change = (property: string, oldValue: string, newValue: string): StyleChange => ({
  property,
  oldValue,
  newValue,
});

describe('patchCssModulesFile — pseudo-state', () => {
  it('creates a :hover rule without touching the resting rule', async () => {
    await writeCss('.btn {\n  color: black;\n}\n');

    await patchCssModulesFile(dir, srcPath(), line, [change('color', 'black', 'red')], {
      state: 'hover',
      targetScope: 'all-instances',
    });

    const css = await readCss();
    expect(css).toMatch(/\.btn\s*\{[^}]*color:\s*black/);
    expect(css).toMatch(/\.btn:hover\s*\{[^}]*color:\s*red/);
  });

  it('patches the resting rule for the normal state', async () => {
    await writeCss('.btn {\n  color: black;\n}\n');

    await patchCssModulesFile(dir, srcPath(), line, [change('color', 'black', 'red')], {
      state: 'normal',
      targetScope: 'all-instances',
    });

    const css = await readCss();
    expect(css).toMatch(/\.btn\s*\{[^}]*color:\s*red/);
    expect(css).not.toMatch(/:hover/);
  });
});
