import { describe, expect, it } from 'vitest';
import { pixelagentSourcePlugin, PIXELAGENT_SOURCE_ATTR } from './source-plugin.js';

interface InlineTransformResult {
  code: string;
  map: unknown;
}

function runTransform(
  pluginInput: ReturnType<typeof pixelagentSourcePlugin>,
  code: string,
  id: string
): InlineTransformResult | null {
  // Vite plugin `transform` may be an object with `handler`; here we wrote a plain function.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const transform = pluginInput.transform as any;
  const fn = typeof transform === 'function' ? transform : transform?.handler;
  if (!fn) throw new Error('source plugin has no transform fn');
  // Vite passes `this` as the plugin context — our plugin never uses it.
  return fn.call({}, code, id);
}

describe('pixelagentSourcePlugin', () => {
  const projectRoot = '/project';

  it('adds data-pa-src to JSX opening elements in .tsx', () => {
    const plugin = pixelagentSourcePlugin({ projectRoot });
    const result = runTransform(
      plugin,
      `export function Hero() {
  return <h1>Hello</h1>;
}`,
      '/project/src/Hero.tsx'
    );
    expect(result).not.toBeNull();
    expect(result!.code).toContain(`${PIXELAGENT_SOURCE_ATTR}="src/Hero.tsx:2"`);
  });

  it('annotates nested and self-closing elements', () => {
    const plugin = pixelagentSourcePlugin({ projectRoot });
    const result = runTransform(
      plugin,
      `export const A = () => (
  <div>
    <span><img src="x" /></span>
  </div>
);`,
      '/project/src/A.tsx'
    );
    expect(result).not.toBeNull();
    const code = result!.code;
    expect(code).toContain(`${PIXELAGENT_SOURCE_ATTR}="src/A.tsx:2"`); // div
    expect(code).toContain(`${PIXELAGENT_SOURCE_ATTR}="src/A.tsx:3"`); // span
    expect(code).toContain(`${PIXELAGENT_SOURCE_ATTR}="src/A.tsx:3"`); // img on same line
  });

  it('does not overwrite existing data-pa-src', () => {
    const plugin = pixelagentSourcePlugin({ projectRoot });
    const result = runTransform(
      plugin,
      `export const A = () => <div data-pa-src="manual.tsx:99">x</div>;`,
      '/project/src/A.tsx'
    );
    // No new attribute should be injected → transform returns null (no mutation).
    expect(result).toBeNull();
  });

  it('skips non-JSX files', () => {
    const plugin = pixelagentSourcePlugin({ projectRoot });
    const result = runTransform(
      plugin,
      `export const x = 1;`,
      '/project/src/util.ts'
    );
    expect(result).toBeNull();
  });

  it('skips node_modules', () => {
    const plugin = pixelagentSourcePlugin({ projectRoot });
    const result = runTransform(
      plugin,
      `export const A = () => <div>x</div>;`,
      '/project/node_modules/foo/dist/index.tsx'
    );
    expect(result).toBeNull();
  });

  it('handles JSX fragments without crashing', () => {
    const plugin = pixelagentSourcePlugin({ projectRoot });
    const result = runTransform(
      plugin,
      `export const A = () => (
  <>
    <span>x</span>
  </>
);`,
      '/project/src/A.tsx'
    );
    // Fragments themselves have no JSXOpeningElement, but the <span> inside should be tagged.
    expect(result).not.toBeNull();
    expect(result!.code).toContain(`${PIXELAGENT_SOURCE_ATTR}="src/A.tsx:3"`);
  });

  it('only runs in serve mode (apply: serve)', () => {
    const plugin = pixelagentSourcePlugin({ projectRoot });
    expect(plugin.apply).toBe('serve');
  });
});
