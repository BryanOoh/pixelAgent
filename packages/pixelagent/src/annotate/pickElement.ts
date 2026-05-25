export const PA_OWN_SELECTOR = '[data-pixelagent-root],[data-pixelagent-toolbar-portal]';

export function isPixelAgentElement(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return !!target.closest(PA_OWN_SELECTOR);
}

export function pickElementAt(x: number, y: number): Element | null {
  const elements = document.elementsFromPoint(x, y);
  return (
    elements.find(
      (el) => el instanceof Element && !el.closest(PA_OWN_SELECTOR)
    ) ?? null
  );
}
