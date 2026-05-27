/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest';
import {
  countElementInstances,
  detectStylingSystem,
  formatAnnotation,
  formatAllAnnotations,
  elementFromDomPath,
  getAllInstancesSelector,
  getElementDisplayLabel,
  getAnnotationSessionDisplay,
  PIXELAGENT_SOURCE_ATTR,
  readReactSource,
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

describe('readReactSource (data-pa-src fallback)', () => {
  it('reads source from data-pa-src on the element', () => {
    document.body.innerHTML = '';
    const el = document.createElement('button');
    el.setAttribute(PIXELAGENT_SOURCE_ATTR, 'packages/demo/src/App.tsx:42');
    document.body.appendChild(el);

    const result = readReactSource(el);
    expect(result.sourceFile).toBe('packages/demo/src/App.tsx');
    expect(result.lineNumber).toBe(42);
  });

  it('walks up to nearest ancestor with data-pa-src', () => {
    document.body.innerHTML = '';
    const parent = document.createElement('section');
    parent.setAttribute(PIXELAGENT_SOURCE_ATTR, 'packages/demo/src/App.tsx:10');
    const child = document.createElement('span');
    parent.appendChild(child);
    document.body.appendChild(parent);

    const result = readReactSource(child);
    expect(result.sourceFile).toBe('packages/demo/src/App.tsx');
    expect(result.lineNumber).toBe(10);
  });

  it('returns null sourceFile when no attribute and no fiber', () => {
    document.body.innerHTML = '';
    const el = document.createElement('div');
    document.body.appendChild(el);
    const result = readReactSource(el);
    expect(result.sourceFile).toBeNull();
    expect(result.lineNumber).toBeNull();
  });

  it('ignores malformed attribute values', () => {
    document.body.innerHTML = '';
    const el = document.createElement('div');
    el.setAttribute(PIXELAGENT_SOURCE_ATTR, 'no-colon-here');
    document.body.appendChild(el);
    const result = readReactSource(el);
    expect(result.sourceFile).toBeNull();
  });
});

describe('detectStylingSystem', () => {
  it('returns inline for an element with only inline styles', () => {
    document.body.innerHTML = '';
    const el = document.createElement('p');
    el.style.color = 'red';
    document.body.appendChild(el);
    expect(detectStylingSystem(el)).toBe('inline');
  });

  it('returns global-css for an element with a regular className', () => {
    document.body.innerHTML = '';
    const el = document.createElement('p');
    el.className = 'site-hero-lead';
    document.body.appendChild(el);
    expect(detectStylingSystem(el)).toBe('global-css');
  });

  it('ignores pa-* classes so inline elements stay inline after a state Apply', () => {
    // Regression for 0.1.9: once the sidecar patcher added `pa-App-8` to a
    // previously inline element, the next Apply was routed to global-css and
    // failed with "No stylesheet rule for .pa-App-8".
    document.body.innerHTML = '';
    const el = document.createElement('p');
    el.className = 'pa-App-8';
    el.style.color = 'blue';
    document.body.appendChild(el);
    expect(detectStylingSystem(el)).toBe('inline');
  });

  it('still detects global-css when pa-* coexists with user classes', () => {
    document.body.innerHTML = '';
    const el = document.createElement('p');
    el.className = 'pa-App-8 site-hero-lead';
    document.body.appendChild(el);
    expect(detectStylingSystem(el)).toBe('global-css');
  });
});
