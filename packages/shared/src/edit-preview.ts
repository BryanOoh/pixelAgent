import type { ElementState, TargetScope } from './types.js';
import { getAllInstancesSelector } from './dom.js';

export const PA_PREVIEW_CLASSES_ATTR = 'data-pa-preview-classes';
export const PA_PREVIEW_DISABLED_CLASS = 'pa-preview-disabled';

const TAILWIND_VARIANT_PREFIX: Partial<Record<ElementState, string>> = {
  hover: 'hover:',
  focus: 'focus:',
  active: 'active:',
  disabled: 'disabled:',
};

/** Elements that receive live style/text preview for the current scope. */
export function getPreviewTargets(element: Element, scope: TargetScope): HTMLElement[] {
  if (scope === 'this-instance') {
    return [element as HTMLElement];
  }
  const selector = getAllInstancesSelector(element);
  try {
    return Array.from(document.querySelectorAll(selector)).filter(
      (el): el is HTMLElement => el instanceof HTMLElement
    );
  } catch {
    return [element as HTMLElement];
  }
}

export function applyTailwindStatePreview(
  elements: HTMLElement[],
  state: ElementState
): void {
  clearTailwindStatePreview(elements);

  if (state === 'normal') return;

  const variantPrefix = TAILWIND_VARIANT_PREFIX[state];
  if (!variantPrefix) return;

  for (const el of elements) {
    if (state === 'focus' && typeof el.focus === 'function') {
      el.focus({ preventScroll: true });
      continue;
    }

    if (state === 'disabled') {
      if (
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        el instanceof HTMLButtonElement ||
        el instanceof HTMLSelectElement
      ) {
        el.disabled = true;
      } else {
        el.setAttribute('aria-disabled', 'true');
        el.classList.add(PA_PREVIEW_DISABLED_CLASS);
      }
      continue;
    }

    const added: string[] = [];
    for (const cls of Array.from(el.classList)) {
      if (!cls.startsWith(variantPrefix)) continue;
      const stripped = cls.slice(variantPrefix.length);
      if (!stripped || el.classList.contains(stripped)) continue;
      el.classList.add(stripped);
      added.push(stripped);
    }
    if (added.length > 0) {
      el.setAttribute(PA_PREVIEW_CLASSES_ATTR, added.join(' '));
    }
  }
}

export function clearTailwindStatePreview(elements: HTMLElement[]): void {
  for (const el of elements) {
    const added = el.getAttribute(PA_PREVIEW_CLASSES_ATTR);
    if (added) {
      for (const cls of added.split(/\s+/).filter(Boolean)) {
        el.classList.remove(cls);
      }
      el.removeAttribute(PA_PREVIEW_CLASSES_ATTR);
    }

    el.removeAttribute('aria-disabled');
    el.classList.remove(PA_PREVIEW_DISABLED_CLASS);

    if (
      el instanceof HTMLInputElement ||
      el instanceof HTMLTextAreaElement ||
      el instanceof HTMLButtonElement ||
      el instanceof HTMLSelectElement
    ) {
      el.disabled = false;
    }
  }
}

export interface InlineStyleSnapshot {
  element: HTMLElement;
  properties: Record<string, string>;
}

export function captureInlineStyles(
  elements: HTMLElement[],
  properties: string[]
): InlineStyleSnapshot[] {
  return elements.map((element) => {
    const props: Record<string, string> = {};
    for (const property of properties) {
      props[property] = element.style.getPropertyValue(property);
    }
    return { element, properties: props };
  });
}

export function restoreInlineStyles(snapshots: InlineStyleSnapshot[]): void {
  for (const { element, properties } of snapshots) {
    for (const [property, value] of Object.entries(properties)) {
      if (value) {
        element.style.setProperty(property, value);
      } else {
        element.style.removeProperty(property);
      }
    }
  }
}

export interface TextSnapshot {
  element: HTMLElement;
  kind: 'textContent' | 'value';
  value: string;
}

export function captureTextSnapshot(
  element: HTMLElement,
  kind: 'textContent' | 'value'
): TextSnapshot {
  if (kind === 'value' && (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) {
    return { element, kind, value: element.value };
  }
  return { element, kind, value: element.textContent ?? '' };
}

export function restoreTextSnapshot(snapshot: TextSnapshot): void {
  if (snapshot.kind === 'value') {
    if (
      snapshot.element instanceof HTMLInputElement ||
      snapshot.element instanceof HTMLTextAreaElement
    ) {
      snapshot.element.value = snapshot.value;
    }
    return;
  }
  snapshot.element.textContent = snapshot.value;
}
