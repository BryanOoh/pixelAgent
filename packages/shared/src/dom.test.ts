/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest';
import {
  countElementInstances,
  formatAnnotation,
  formatAllAnnotations,
  elementFromDomPath,
  getAllInstancesSelector,
  getElementDisplayLabel,
  getAnnotationSessionDisplay,
  shortenSelectorForDisplay,
} from './dom.js';
import type { AnnotationEntry } from './types.js';

const baseEntry: AnnotationEntry = {
  id: '1',
  selector: 'button.hero-cta',
  note: 'Increase font size to 16px',
  createdAt: Date.now(),
};

describe('formatAnnotation', () => {
  it('formats selector and note', () => {
    expect(formatAnnotation(baseEntry)).toBe(
      'button.hero-cta | "Increase font size to 16px"'
    );
  });

  it('includes position, text, and source when available', () => {
    const entry: AnnotationEntry = {
      ...baseEntry,
      position: { x: 240, y: 580 },
      selectedText: 'Get started',
      sourceFile: 'components/Hero.tsx',
      lineNumber: 42,
      note: 'Increase font size',
    };
    expect(formatAnnotation(entry)).toBe(
      'button.hero-cta | pos:240,580 | text:"Get started" | src:components/Hero.tsx:42 | "Increase font size"'
    );
  });

  it('uses elementText when selectedText is absent', () => {
    const entry: AnnotationEntry = {
      ...baseEntry,
      elementText: 'Get started',
    };
    expect(formatAnnotation(entry)).toContain('text:"Get started"');
  });
});

describe('formatAllAnnotations', () => {
  it('returns empty string for no entries', () => {
    expect(formatAllAnnotations([])).toBe('');
  });

  it('formats multiple entries with structured markdown header', () => {
    const result = formatAllAnnotations([baseEntry, { ...baseEntry, id: '2' }]);
    expect(result).toContain('# PixelAgent Annotations (2)');
    expect(result).toContain('### 1. `button.hero-cta`');
    expect(result).toContain('### 2. `button.hero-cta`');
    expect(result).toContain('- **note:** Increase font size to 16px');
  });

  it('includes source in markdown blocks when present', () => {
    const entry: AnnotationEntry = {
      ...baseEntry,
      sourceFile: 'components/Hero.tsx',
      lineNumber: 42,
    };
    const result = formatAllAnnotations([entry]);
    expect(result).toContain('- **source:** `components/Hero.tsx:42`');
  });
});

describe('getAllInstancesSelector / countElementInstances', () => {
  it('counts every element with the same semantic class', () => {
    document.body.innerHTML = `
      <nav>
        <a class="site-nav-link" href="#">Work</a>
        <a class="site-nav-link" href="#">About</a>
        <a class="site-nav-link" href="#">Contact</a>
      </nav>
    `;
    const links = document.querySelectorAll('.site-nav-link');
    expect(links.length).toBe(3);
    expect(countElementInstances(links[0])).toBe(3);
    expect(getAllInstancesSelector(links[0])).toBe('a.site-nav-link');
  });
});

describe('getElementDisplayLabel', () => {
  it('prefers short id over class path', () => {
    document.body.innerHTML = '<button id="save" class="hero-cta flex p-4">Save</button>';
    const el = document.querySelector('button')!;
    expect(getElementDisplayLabel(el)).toBe('#save');
  });

  it('uses first semantic class when no id', () => {
    document.body.innerHTML = '<button class="flex p-4 hero-cta">Save</button>';
    const el = document.querySelector('button')!;
    expect(getElementDisplayLabel(el)).toBe('button.hero-cta');
  });

  it('uses tag and text preview for plain buttons', () => {
    document.body.innerHTML = '<button>Get started</button>';
    const el = document.querySelector('button')!;
    expect(getElementDisplayLabel(el)).toBe('button · Get started');
  });

  it('skips pixelagent internal classes', () => {
    document.body.innerHTML = '<div class="pa-glass-btn flex">X</div>';
    const el = document.querySelector('div')!;
    expect(getElementDisplayLabel(el)).toBe('div');
  });

  it('falls back to semantic class instead of root App component', () => {
    document.body.innerHTML =
      '<button class="site-btn site-btn-primary">Try PixelAgent</button>';
    const el = document.querySelector('button')!;
    expect(getElementDisplayLabel(el)).toBe('button.site-btn');
  });
});

describe('getAnnotationSessionDisplay', () => {
  it('shows short selector and note, not full path', () => {
    const entry: AnnotationEntry = {
      ...baseEntry,
      selector:
        'div:nth-of-type(1) > div.site-app > main.site-main > p.site-skills-body',
      note: 'test',
      elementText: 'Two complementary workflows on the same live page',
      sourceFile: 'packages/demo/src/App.tsx',
      lineNumber: 151,
    };
    const display = getAnnotationSessionDisplay(entry);
    expect(display.target).toBe('p.site-skills-body');
    expect(display.note).toBe('test');
    expect(display.meta).toContain('packages/demo/src/App.tsx:151');
    expect(display.meta).toContain('Two complementary');
  });

  it('uses component name when set and not a root wrapper', () => {
    const entry: AnnotationEntry = {
      ...baseEntry,
      componentName: 'GlassButton',
      note: 'Increase padding',
    };
    expect(getAnnotationSessionDisplay(entry).target).toBe('GlassButton');
  });

  it('shortens multi-select to element count', () => {
    const entry: AnnotationEntry = {
      ...baseEntry,
      selectors: ['a.one', 'a.two', 'a.three'],
      note: 'Align nav',
    };
    expect(getAnnotationSessionDisplay(entry).target).toBe('3 elements');
  });
});

describe('shortenSelectorForDisplay', () => {
  it('returns last path segment', () => {
    expect(shortenSelectorForDisplay('div > main > p.hero')).toBe('p.hero');
  });
});

describe('elementFromDomPath', () => {
  it('returns null for invalid paths', () => {
    expect(elementFromDomPath('')).toBeNull();
    expect(elementFromDomPath('invalid')).toBeNull();
  });
});
