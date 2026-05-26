import type { AnnotationEntry, TargetScope } from './types.js';

const RELEVANT_STYLE_PROPS = [
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'line-height',
  'text-align',
  'text-decoration',
  'color',
  'background-color',
  'padding',
  'margin',
  'width',
  'height',
  'border-width',
  'border-style',
  'border-color',
  'border-radius',
  'opacity',
  'display',
  'gap',
] as const;

function escapeCssIdent(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value);
  }
  return value.replace(/([^\w-])/g, '\\$1');
}

export interface CssSelectorOptions {
  /** When false, omit nth-of-type suffixes (for all-instances matching). Default true. */
  disambiguate?: boolean;
}

export function getCssSelector(element: Element, options: CssSelectorOptions = {}): string {
  const disambiguate = options.disambiguate !== false;
  if (element.id) {
    return `#${escapeCssIdent(element.id)}`;
  }

  const testId = element.getAttribute('data-testid');
  if (testId) {
    return `[data-testid="${escapeCssIdent(testId)}"]`;
  }

  const parts: string[] = [];
  let current: Element | null = element;

  while (current && current.nodeType === Node.ELEMENT_NODE) {
    let part = current.tagName.toLowerCase();

    if (current.classList.length > 0) {
      const classes = Array.from(current.classList)
        .slice(0, 4)
        .map((c) => `.${escapeCssIdent(c)}`)
        .join('');
      part += classes;
    }

    if (disambiguate && current.parentElement) {
      const sameTag = Array.from(current.parentElement.children).filter(
        (child) => child.tagName === current!.tagName
      );
      if (sameTag.length > 1) {
        const index = sameTag.indexOf(current) + 1;
        part += `:nth-of-type(${index})`;
      }
    }

    parts.unshift(part);

    if (current.id || current.getAttribute('data-testid')) break;
    current = current.parentElement;
  }

  return parts.join(' > ');
}

/**
 * Short selector matching every DOM instance that shares the element's tag + semantic classes.
 * Used for all-instances preview count and querySelectorAll (e.g. all `a.site-nav-link` in nav).
 */
export function getAllInstancesSelector(element: Element): string {
  if (element.id) {
    return `#${escapeCssIdent(element.id)}`;
  }

  const testId = element.getAttribute('data-testid');
  if (testId) {
    return `[data-testid="${escapeCssIdent(testId)}"]`;
  }

  const tag = element.tagName.toLowerCase();
  const semanticClasses = Array.from(element.classList).filter(
    (c) => !INTERNAL_CLASS_RE.test(c) && !isUtilityClass(c)
  );

  if (semanticClasses.length > 0) {
    return (
      tag + semanticClasses.slice(0, 4).map((c) => `.${escapeCssIdent(c)}`).join('')
    );
  }

  return getCssSelector(element, { disambiguate: false });
}

/** How many elements on the page match {@link getAllInstancesSelector}. */
export function countElementInstances(element: Element): number {
  if (typeof document === 'undefined') return 1;
  const selector = getAllInstancesSelector(element);
  try {
    return document.querySelectorAll(selector).length;
  } catch {
    return 1;
  }
}

/** Selector stored in Apply payload and used for scope-aware matching. */
export function getScopeSelector(element: Element, scope: TargetScope): string {
  if (scope === 'this-instance') {
    return getCssSelector(element, { disambiguate: true });
  }
  return getAllInstancesSelector(element);
}

const TAILWIND_CLASS_RE =
  /\b(flex|grid|inline|block|hidden|p-|px-|py-|pt-|pr-|pb-|pl-|m-|mx-|my-|mt-|mr-|mb-|ml-|text-|bg-|rounded|w-|h-|gap-|opacity-|border-|items-|justify-|font-|leading-|max-w-|min-h-)/;

const INTERNAL_CLASS_RE = /^(pa-|pixelagent)/i;
const GENERIC_COMPONENT_NAMES = new Set([
  'Anonymous',
  'Fragment',
  'StrictMode',
  'Suspense',
]);

/** Root/layout wrappers — too coarse for element labels (design mode skips these). */
const ROOT_WRAPPER_NAMES = new Set([
  'App',
  'Root',
  'Layout',
  'Page',
  'Providers',
  'Provider',
  'ThemeProvider',
  'Router',
  'BrowserRouter',
  'Document',
  'Html',
  'Body',
]);

function isRootWrapperName(name: string): boolean {
  // /^__/ catches framework internals like __next_root_layout_boundary__
  // that Next.js inserts above user components in the fiber tree.
  return ROOT_WRAPPER_NAMES.has(name) || /^Next/.test(name) || /^__/.test(name);
}

const TEXT_PREVIEW_TAGS = new Set([
  'button',
  'a',
  'label',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'p',
  'span',
  'li',
  'td',
  'th',
]);

function truncateDisplayLabel(value: string, max = 48): string {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

function isUtilityClass(className: string): boolean {
  return TAILWIND_CLASS_RE.test(className);
}

function resolveFiberTypeName(type: unknown): string | null {
  if (typeof type === 'function') {
    const fn = type as { displayName?: string; name?: string };
    const name = fn.displayName || fn.name;
    if (name && !GENERIC_COMPONENT_NAMES.has(name)) return name;
  }

  if (typeof type === 'object' && type !== null) {
    const obj = type as {
      displayName?: string;
      render?: { displayName?: string; name?: string };
      type?: unknown;
    };
    if (obj.displayName && !GENERIC_COMPONENT_NAMES.has(obj.displayName)) {
      return obj.displayName;
    }
    if (typeof obj.render === 'function') {
      const render = obj.render as { displayName?: string; name?: string };
      const name = render.displayName || render.name;
      if (name && !GENERIC_COMPONENT_NAMES.has(name)) return name;
    }
    if (obj.type) return resolveFiberTypeName(obj.type);
  }

  return null;
}

// Production bundlers (Terser, SWC) mangle component function names down to
// 1–2 characters (`S`, `e`, `Ab`). Those reveal nothing to a designer, so we
// skip them and let getElementDisplayLabel fall through to tag + text/class.
function isLikelyMinifiedName(name: string): boolean {
  return name.length <= 2;
}

/** Nearest React component name for design-mode-style labels. */
export function getNearestReactComponentName(element: Element): string | null {
  const fiberKey = Object.keys(element).find(
    (key) => key.startsWith('__reactFiber$') || key.startsWith('__reactInternalInstance$')
  );
  if (!fiberKey) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let fiber: any = (element as unknown as Record<string, unknown>)[fiberKey];

  while (fiber) {
    const name = resolveFiberTypeName(fiber.type);
    if (name && !isRootWrapperName(name) && !isLikelyMinifiedName(name)) return name;
    fiber = fiber.return;
  }

  return null;
}

function pickDisplayClass(element: Element): string | null {
  for (const className of element.classList) {
    if (INTERNAL_CLASS_RE.test(className)) continue;
    if (isUtilityClass(className)) continue;
    if (className.length > 40) continue;
    return className;
  }
  return null;
}

function getDirectTextPreview(element: Element): string | null {
  const html = element as HTMLElement;
  const raw = (html.innerText || html.textContent || '').trim().replace(/\s+/g, ' ');
  if (!raw) return null;
  return raw.length > 28 ? `${raw.slice(0, 27)}…` : raw;
}

/**
 * Short, human-readable label for overlays (design-mode style).
 * Full selectors remain in copy payloads via getCssSelector.
 */
export function getElementDisplayLabel(element: Element): string {
  const component = getNearestReactComponentName(element);
  if (component) return component;

  const tag = element.tagName.toLowerCase();
  const id = element.id?.trim();
  if (id && id.length <= 48 && !/\s/.test(id)) {
    return `#${id}`;
  }

  const displayClass = pickDisplayClass(element);
  if (displayClass) return `${tag}.${displayClass}`;

  const ariaLabel = element.getAttribute('aria-label')?.trim();
  if (ariaLabel) return truncateDisplayLabel(`${tag} · ${ariaLabel}`);

  const title = element.getAttribute('title')?.trim();
  if (title && (tag === 'button' || tag === 'a' || element.getAttribute('role') === 'button')) {
    return truncateDisplayLabel(title);
  }

  if (TEXT_PREVIEW_TAGS.has(tag)) {
    const text = getDirectTextPreview(element);
    if (text) return truncateDisplayLabel(`${tag} · ${text}`);
  }

  return tag;
}

export function getDomPath(element: Element): string {
  const parts: string[] = [];
  let current: Element | null = element;

  while (current && current.nodeType === Node.ELEMENT_NODE) {
    const tag = current.tagName.toLowerCase();
    const index =
      current.parentElement
        ? Array.from(current.parentElement.children).indexOf(current) + 1
        : 1;
    parts.unshift(`${tag}:nth-child(${index})`);
    current = current.parentElement;
  }

  return parts.join(' > ');
}

/** Resolve a live DOM element from a stored domPath (annotate → edit handoff). */
export function elementFromDomPath(domPath: string): Element | null {
  if (typeof document === 'undefined') return null;

  const parts = domPath.split(' > ').filter(Boolean);
  if (parts.length === 0) return null;

  let current: Element | null = document.documentElement;

  for (const part of parts) {
    const match = part.match(/^([a-z0-9-]+):nth-child\((\d+)\)$/i);
    if (!match || !current) return null;

    const tag = match[1].toLowerCase();
    const index = parseInt(match[2], 10) - 1;
    const child: Element | undefined = current.children[index] as Element | undefined;

    if (!child || child.tagName.toLowerCase() !== tag) {
      return null;
    }
    current = child;
  }

  return current;
}

/** Resolve element from an annotation entry (selector first, domPath fallback). */
export function resolveElementFromEntry(entry: AnnotationEntry): Element | null {
  if (entry.domPath) {
    const fromPath = elementFromDomPath(entry.domPath);
    if (fromPath) return fromPath;
  }

  try {
    const el = document.querySelector(entry.selector);
    if (el instanceof Element) return el;
  } catch {
    // Invalid selector
  }

  return null;
}

/** Non-empty trimmed text from the current window selection. */
export function getWindowSelectionText(): string | undefined {
  if (typeof window === 'undefined') return undefined;

  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
    return undefined;
  }

  const text = selection.toString().replace(/\s+/g, ' ').trim();
  return text.length > 0 ? text : undefined;
}

export function getRelevantComputedStyles(element: Element): Record<string, string> {
  const computed = getComputedStyle(element);
  const styles: Record<string, string> = {};

  for (const prop of RELEVANT_STYLE_PROPS) {
    const value = computed.getPropertyValue(prop);
    if (value) {
      styles[prop] = value;
    }
  }

  return styles;
}

export function formatComputedStyles(styles: Record<string, string>): string {
  return Object.entries(styles)
    .map(([key, value]) => `${key}:${value}`)
    .join(' | ');
}

export function formatAnnotation(entry: AnnotationEntry): string {
  const parts: string[] = [entry.selector];

  if (entry.position) {
    parts.push(`pos:${entry.position.x},${entry.position.y}`);
  }

  const text = entry.selectedText ?? entry.elementText;
  if (text) {
    parts.push(`text:"${text.replace(/"/g, '\\"')}"`);
  }

  if (entry.sourceFile) {
    parts.push(
      `src:${entry.sourceFile}${entry.lineNumber != null ? `:${entry.lineNumber}` : ''}`
    );
  }

  if (entry.selectors && entry.selectors.length > 1) {
    parts.push(`selectors:${entry.selectors.join(';')}`);
  }

  parts.push(`"${entry.note.replace(/"/g, '\\"')}"`);

  return parts.join(' | ');
}

export interface AnnotationSessionDisplay {
  target: string;
  note: string;
  meta?: string;
}

/** Last segment of a stored selector path — readable in session list. */
export function shortenSelectorForDisplay(selector: string): string {
  if (selector === 'area-selection') return 'Area selection';
  const parts = selector.split(' > ').filter(Boolean);
  return parts[parts.length - 1] ?? selector;
}

/** Compact session-panel row (copy payloads still use formatAnnotation). */
export function getAnnotationSessionDisplay(entry: AnnotationEntry): AnnotationSessionDisplay {
  let target: string;

  if (entry.selectors && entry.selectors.length > 1) {
    target = `${entry.selectors.length} elements`;
  } else if (
    entry.componentName &&
    !isRootWrapperName(entry.componentName)
  ) {
    target = entry.componentName;
  } else {
    target = shortenSelectorForDisplay(entry.selector);
  }

  const metaParts: string[] = [];
  if (entry.sourceFile) {
    metaParts.push(
      `${entry.sourceFile}${entry.lineNumber != null ? `:${entry.lineNumber}` : ''}`
    );
  }

  const text = entry.selectedText ?? entry.elementText;
  if (text) {
    const preview = text.replace(/\s+/g, ' ').trim();
    metaParts.push(preview.length > 72 ? `${preview.slice(0, 71)}…` : preview);
  }

  return {
    target,
    note: entry.note,
    meta: metaParts.length > 0 ? metaParts.join(' · ') : undefined,
  };
}

function formatAnnotationBlock(entry: AnnotationEntry, index: number): string {
  const lines: string[] = [`### ${index}. \`${entry.selector}\``];
  lines.push(`- **note:** ${entry.note}`);

  const text = entry.selectedText ?? entry.elementText;
  if (text) lines.push(`- **text:** ${text}`);
  if (entry.selectedText && entry.elementText && entry.selectedText !== entry.elementText) {
    lines.push(`- **element:** ${entry.elementText}`);
  }

  if (entry.selectors && entry.selectors.length > 1) {
    lines.push(`- **selectors:** ${entry.selectors.map((s) => `\`${s}\``).join(', ')}`);
  }

  if (entry.sourceFile) {
    const loc = `${entry.sourceFile}${entry.lineNumber != null ? `:${entry.lineNumber}` : ''}`;
    lines.push(`- **source:** \`${loc}\``);
  }

  if (entry.componentName) {
    lines.push(`- **component:** ${entry.componentName}`);
  }

  return lines.join('\n');
}

export function formatAllAnnotations(entries: AnnotationEntry[]): string {
  if (entries.length === 0) return '';

  const header: string[] = [`# PixelAgent Annotations (${entries.length})`, '', '---', ''];

  const body = entries.map((e, i) => formatAnnotationBlock(e, i + 1)).join('\n\n');
  return header.join('\n') + body;
}

/** Elements whose bounding box intersects a screen-space rectangle (area annotate). */
export function getElementsInArea(
  rect: { x: number; y: number; width: number; height: number },
  excludeSelector: string
): Element[] {
  const seen = new Set<Element>();
  const results: Element[] = [];

  const samplePoints: Array<[number, number]> = [
    [rect.x + rect.width / 2, rect.y + rect.height / 2],
    [rect.x + 8, rect.y + 8],
    [rect.x + rect.width - 8, rect.y + rect.height - 8],
    [rect.x + rect.width / 2, rect.y + 8],
    [rect.x + 8, rect.y + rect.height / 2],
  ];

  for (const [x, y] of samplePoints) {
    for (const el of document.elementsFromPoint(x, y)) {
      if (!(el instanceof Element) || el.closest(excludeSelector)) continue;
      if (seen.has(el)) continue;

      const box = el.getBoundingClientRect();
      const intersects =
        box.left < rect.x + rect.width &&
        box.right > rect.x &&
        box.top < rect.y + rect.height &&
        box.bottom > rect.y;

      if (intersects) {
        seen.add(el);
        results.push(el);
      }
    }
  }

  return results;
}

export function copyToClipboard(text: string): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }
  return Promise.reject(new Error('Clipboard API unavailable'));
}

/** Project-relative path for MCP / Apply payloads (monorepo-safe). */
export function normalizeSourcePath(fileName: string): string {
  const normalized = fileName.replace(/\\/g, '/');
  const packagesIdx = normalized.indexOf('packages/');
  if (packagesIdx >= 0) return normalized.slice(packagesIdx);
  const srcIdx = normalized.lastIndexOf('/src/');
  if (srcIdx >= 0) return normalized.slice(srcIdx + 1);
  return normalized;
}

export function readReactSource(element: Element): {
  sourceFile: string | null;
  lineNumber: number | null;
  componentName: string | null;
} {
  const fiberKey = Object.keys(element).find(
    (key) => key.startsWith('__reactFiber$') || key.startsWith('__reactInternalInstance$')
  );

  if (!fiberKey) {
    return { sourceFile: null, lineNumber: null, componentName: null };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let fiber: any = (element as unknown as Record<string, unknown>)[fiberKey];

  while (fiber) {
    const source = fiber?._debugSource ?? fiber?.type?.__source;
    if (source?.fileName) {
      return {
        sourceFile: normalizeSourcePath(source.fileName),
        lineNumber: source.lineNumber ?? null,
        componentName: typeof fiber.type === 'function' ? fiber.type.name : null,
      };
    }
    fiber = fiber.return;
  }

  return { sourceFile: null, lineNumber: null, componentName: null };
}

export function detectStylingSystem(element: Element): import('./types.js').StylingSystem {
  const classList = element.classList;

  if (classList.length > 0) {
    const classes = Array.from(classList).join(' ');
    if (TAILWIND_CLASS_RE.test(classes)) {
      return 'tailwind';
    }
    if (classes.includes('_')) {
      return 'css-modules';
    }
    return 'global-css';
  }

  if ((element as HTMLElement).style?.length > 0) {
    return 'inline';
  }

  return 'inline';
}

export type TextEditKind = 'textContent' | 'value' | 'none';

export interface EditableTextInfo {
  kind: TextEditKind;
  value: string;
}

const INLINE_TEXT_CHILD_TAGS = new Set([
  'SPAN',
  'STRONG',
  'EM',
  'B',
  'I',
  'A',
  'BR',
  'SMALL',
  'LABEL',
]);

const NON_TEXT_EDITABLE_TAGS = new Set([
  'IMG',
  'SVG',
  'VIDEO',
  'CANVAS',
  'BR',
  'HR',
  'INPUT',
  'SELECT',
  'IFRAME',
]);

/** Whether this element supports inline text editing in Edit mode */
export function getEditableTextInfo(element: Element): EditableTextInfo {
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    return { kind: 'value', value: element.value };
  }

  if (NON_TEXT_EDITABLE_TAGS.has(element.tagName)) {
    return { kind: 'none', value: '' };
  }

  const hasComplexChildren =
    element.childElementCount > 0 &&
    !Array.from(element.children).every((child) =>
      INLINE_TEXT_CHILD_TAGS.has(child.tagName)
    );

  if (hasComplexChildren) {
    return { kind: 'none', value: '' };
  }

  const text = (element as HTMLElement).innerText.replace(/\s+/g, ' ').trim();
  return { kind: 'textContent', value: text };
}

/** Live DOM preview for text edits */
export function setEditableTextPreview(
  element: Element,
  kind: TextEditKind,
  value: string
): void {
  if (kind === 'value') {
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      element.value = value;
    }
    return;
  }
  if (kind === 'textContent') {
    (element as HTMLElement).textContent = value;
  }
}

