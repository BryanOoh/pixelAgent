import type { TextEditKind } from '@pixelagent/shared';
import { hasPositiveBorderWidth } from './propertyControls.js';

export type EditSectionId =
  | 'targeting'
  | 'content'
  | 'typography'
  | 'layout'
  | 'fill'
  | 'border';

const TYPOGRAPHY_TAGS = new Set([
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'p',
  'span',
  'a',
  'label',
  'li',
  'td',
  'th',
  'strong',
  'em',
  'small',
  'blockquote',
  'cite',
  'figcaption',
]);

const CONTROL_TAGS = new Set(['button', 'input', 'select', 'textarea']);

const MEDIA_TAGS = new Set(['img', 'video', 'canvas', 'svg', 'picture']);

const CONTAINER_TAGS = new Set([
  'div',
  'section',
  'article',
  'main',
  'aside',
  'header',
  'footer',
  'nav',
  'ul',
  'ol',
  'form',
  'figure',
  'details',
  'summary',
  'fieldset',
]);

function hasVisibleFill(backgroundColor: string | undefined): boolean {
  const bg = (backgroundColor ?? '').trim().toLowerCase();
  if (!bg) return false;
  if (bg === 'transparent') return false;
  if (bg === 'rgba(0, 0, 0, 0)') return false;
  return true;
}

function hasVisibleBorder(values: Record<string, string>): boolean {
  const style = (values['border-style'] ?? '').trim().toLowerCase();
  if (style && style !== 'none') return true;
  return hasPositiveBorderWidth(values['border-width'] ?? '');
}

/**
 * Pick at most two sections to expand when an element is selected.
 * Targeting stays collapsed by default — it is meta, not visual styling.
 */
export function getDefaultOpenSectionsForTag(
  tagName: string,
  textKind: TextEditKind,
  values: Record<string, string>
): Set<EditSectionId> {
  const tag = tagName.toLowerCase();
  const open = new Set<EditSectionId>();

  const add = (id: EditSectionId) => {
    if (open.size < 2) open.add(id);
  };

  if (textKind !== 'none') {
    add('content');
    add('typography');
    return open;
  }

  if (TYPOGRAPHY_TAGS.has(tag)) {
    add('typography');
    return open;
  }

  if (CONTROL_TAGS.has(tag)) {
    add('layout');
    add('typography');
    return open;
  }

  if (MEDIA_TAGS.has(tag)) {
    add('layout');
    return open;
  }

  if (CONTAINER_TAGS.has(tag)) {
    add('layout');
    if (hasVisibleBorder(values)) add('border');
    else if (hasVisibleFill(values['background-color'])) add('fill');
    return open;
  }

  if (tag === 'hr') {
    add('border');
    return open;
  }

  add('layout');
  return open;
}

export function getDefaultOpenSections(
  element: Element,
  textKind: TextEditKind,
  values: Record<string, string>
): Set<EditSectionId> {
  return getDefaultOpenSectionsForTag(element.tagName, textKind, values);
}

export function isSectionOpen(
  sections: Set<EditSectionId>,
  id: EditSectionId
): boolean {
  return sections.has(id);
}
