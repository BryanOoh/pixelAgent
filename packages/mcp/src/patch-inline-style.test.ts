import { describe, expect, it } from 'vitest';
import { patchInlineStyle } from './tools.js';

describe('patchInlineStyle', () => {
  describe('existing style={{}} block', () => {
    it('updates an existing property in place', () => {
      const out = patchInlineStyle(
        `      <p style={{ color: 'red', padding: '8px' }}>`,
        'color',
        'blue'
      );
      expect(out.warning).toBeUndefined();
      expect(out.line).toContain(`color: 'blue'`);
      expect(out.line).toContain(`padding: '8px'`);
    });

    it('appends a new property when the block exists without it', () => {
      const out = patchInlineStyle(`      <p style={{ padding: '8px' }}>`, 'color', 'red');
      expect(out.warning).toBeUndefined();
      expect(out.line).toContain(`padding: '8px'`);
      expect(out.line).toContain(`color: 'red'`);
    });

    it('converts kebab-case CSS to camelCase JSX', () => {
      const out = patchInlineStyle(`      <p style={{}}>`, 'font-size', '16px');
      expect(out.line).toContain(`fontSize: '16px'`);
    });
  });

  describe('missing style block — injection', () => {
    it('injects a style attribute into a plain JSX tag', () => {
      const out = patchInlineStyle(`      <h1>PixelAgent UI Verify</h1>`, 'color', 'red');
      expect(out.warning).toBeUndefined();
      expect(out.line).toBe(`      <h1 style={{ color: 'red' }}>PixelAgent UI Verify</h1>`);
    });

    it('preserves existing attributes when injecting', () => {
      const out = patchInlineStyle(
        `      <h1 className="title" id="hero">Title</h1>`,
        'color',
        'red'
      );
      expect(out.line).toContain(`className="title"`);
      expect(out.line).toContain(`id="hero"`);
      expect(out.line).toContain(`style={{ color: 'red' }}`);
    });

    it('preserves self-closing form', () => {
      const out = patchInlineStyle(`      <img src="x.png" />`, 'opacity', '0.5');
      expect(out.line).toBe(`      <img src="x.png" style={{ opacity: '0.5' }} />`);
    });

    it('warns when no JSX tag is on the line', () => {
      const out = patchInlineStyle(`      const value = 42;`, 'color', 'red');
      expect(out.warning).toBeDefined();
    });
  });
});
