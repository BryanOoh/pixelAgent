/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest';
import {
  formatAllAnnotations,
  formatAnnotation,
  getAnnotationSessionDisplay,
} from './dom.js';
import type { AnnotationEntry } from './types.js';

/** Representative entry after Click → Note → Add on demo hero lead. */
const goldenEntry: AnnotationEntry = {
  id: 'golden-1',
  selector:
    'div.site-app > main.site-main > section.site-hero > p.site-hero-lead',
  note: 'Increase line height for readability',
  position: { x: 24, y: 420 },
  elementText:
    'PixelAgent is a live DOM layer for vibe coders — annotate elements, tweak styles in place, and ship one structured diff to your agent. No screenshots. No round-trips.',
  sourceFile: 'packages/demo/src/App.tsx',
  lineNumber: 113,
  componentName: null,
  createdAt: 1_700_000_000_000,
};

describe('annotate golden path — copy payload', () => {
  it('formatAllAnnotations matches agent markdown contract', () => {
    const markdown = formatAllAnnotations([goldenEntry]);

    expect(markdown).toMatch(/^# PixelAgent Annotations \(1\)/m);
    expect(markdown).toContain('---');
    expect(markdown).toContain('### 1. `div.site-app > main.site-main');
    expect(markdown).toContain('- **note:** Increase line height for readability');
    expect(markdown).toContain('- **text:** PixelAgent is a live DOM layer');
    expect(markdown).toContain('- **source:** `packages/demo/src/App.tsx:113`');
    expect(markdown).not.toContain('verbosity');
    expect(markdown).not.toContain('viewport');
  });

  it('formatAnnotation single-line copy includes note and context', () => {
    const line = formatAnnotation(goldenEntry);

    expect(line).toContain('p.site-hero-lead');
    expect(line).toContain('pos:24,420');
    expect(line).toContain('text:"PixelAgent is a live DOM layer');
    expect(line).toContain('src:packages/demo/src/App.tsx:113');
    expect(line).toContain('"Increase line height for readability"');
  });

  it('session display stays compact while copy stays verbose', () => {
    const display = getAnnotationSessionDisplay(goldenEntry);

    expect(display.target).toBe('p.site-hero-lead');
    expect(display.note).toBe('Increase line height for readability');
    expect(display.meta).toContain('App.tsx:113');
    expect(display.target).not.toContain('div.site-app >');
  });
});
