import { describe, expect, it } from 'vitest';
import { getDefaultOpenSectionsForTag } from './editSectionDefaults.js';

describe('getDefaultOpenSectionsForTag', () => {
  it('opens content + typography for editable text', () => {
    const sections = getDefaultOpenSectionsForTag('p', 'textContent', {});
    expect(sections).toEqual(new Set(['content', 'typography']));
  });

  it('opens typography for headings without direct text edit', () => {
    const sections = getDefaultOpenSectionsForTag('h1', 'none', {});
    expect(sections).toEqual(new Set(['typography']));
  });

  it('opens layout + typography for buttons', () => {
    const sections = getDefaultOpenSectionsForTag('button', 'none', {});
    expect(sections).toEqual(new Set(['layout', 'typography']));
  });

  it('opens layout only for images', () => {
    const sections = getDefaultOpenSectionsForTag('img', 'none', {});
    expect(sections).toEqual(new Set(['layout']));
  });

  it('opens layout + border for containers with a stroke', () => {
    const sections = getDefaultOpenSectionsForTag('div', 'none', {
      'border-width': '1px',
      'border-style': 'solid',
    });
    expect(sections).toEqual(new Set(['layout', 'border']));
  });

  it('opens layout + fill for containers with background', () => {
    const sections = getDefaultOpenSectionsForTag('section', 'none', {
      'background-color': 'rgb(20, 20, 24)',
    });
    expect(sections).toEqual(new Set(['layout', 'fill']));
  });

  it('never opens more than two sections', () => {
    const sections = getDefaultOpenSectionsForTag('p', 'textContent', {
      'background-color': 'red',
      'border-width': '2px',
    });
    expect(sections.size).toBeLessThanOrEqual(2);
  });
});
