import type { AnnotationEntry } from '@pixelagent/shared';
import {
  getCssSelector,
  getDomPath,
  getEditableTextInfo,
  getNearestReactComponentName,
  getWindowSelectionText,
  readReactSource,
} from '@pixelagent/shared';

export interface BuildAnnotationInput {
  elements: Element[];
  note: string;
  areaBbox?: { x: number; y: number; width: number; height: number };
}

export function buildAnnotationEntry(input: BuildAnnotationInput): AnnotationEntry {
  const { elements, note, areaBbox } = input;
  const primary = elements[0];

  if (!primary && areaBbox) {
    return {
      id: crypto.randomUUID(),
      selector: 'area-selection',
      note: note.trim(),
      areaBbox,
      position: { x: Math.round(areaBbox.x), y: Math.round(areaBbox.y) },
      bbox: {
        x: Math.round(areaBbox.x),
        y: Math.round(areaBbox.y),
        width: Math.round(areaBbox.width),
        height: Math.round(areaBbox.height),
      },
      createdAt: Date.now(),
    };
  }

  if (!primary) {
    throw new Error('buildAnnotationEntry requires at least one element or areaBbox');
  }

  const rect = primary.getBoundingClientRect();
  const source = readReactSource(primary);
  const selectedText = getWindowSelectionText();
  const textInfo = getEditableTextInfo(primary);
  const elementText = textInfo.kind !== 'none' ? textInfo.value : undefined;
  const selectors = elements.map((el) => getCssSelector(el));

  return {
    id: crypto.randomUUID(),
    selector: selectors[0],
    selectors: selectors.length > 1 ? selectors : undefined,
    note: note.trim(),
    position: { x: Math.round(rect.x), y: Math.round(rect.y) },
    bbox: {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    },
    areaBbox,
    domPath: getDomPath(primary),
    selectedText,
    elementText,
    sourceFile: source.sourceFile,
    lineNumber: source.lineNumber,
    componentName: getNearestReactComponentName(primary) ?? source.componentName,
    createdAt: Date.now(),
  };
}
