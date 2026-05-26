import { useCallback, useEffect, useRef, useState } from 'react';
import type { ElementState, StyleChange, TargetScope } from '@pixelagent/shared';
import {
  applyTailwindStatePreview,
  captureInlineStyles,
  captureTextSnapshot,
  clearTailwindStatePreview,
  getEditableTextInfo,
  getPreviewTargets,
  getRelevantComputedStyles,
  restoreInlineStyles,
  restoreTextSnapshot,
  setEditableTextPreview,
  type InlineStyleSnapshot,
  type TextEditKind,
  type TextSnapshot,
} from '@pixelagent/shared';
import { hasPositiveBorderWidth } from './propertyControls.js';

const MAX_UNDO = 50;

const STYLE_PROP_KEYS = [
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
  'gap',
  'display',
  'border-width',
  'border-style',
  'border-color',
  'border-radius',
  'opacity',
] as const;

interface HistoryFrame {
  inline: InlineStyleSnapshot[];
  text: TextSnapshot | null;
}

export interface EditPreviewApi {
  clearPreviews: () => void;
  revertPreviews: () => void;
}

export function useEditPreview(
  selectedElement: Element | null,
  targetScope: TargetScope,
  elementState: ElementState
) {
  const targetsRef = useRef<HTMLElement[]>([]);
  const touchedRef = useRef<Set<HTMLElement>>(new Set());
  const initialInlineRef = useRef<InlineStyleSnapshot[]>([]);
  const initialTextRef = useRef<TextSnapshot | null>(null);
  const undoStackRef = useRef<HistoryFrame[]>([]);

  const [values, setValues] = useState<Record<string, string>>({});
  const [originalValues, setOriginalValues] = useState<Record<string, string>>({});
  const [textKind, setTextKind] = useState<TextEditKind>('none');
  const [textValue, setTextValue] = useState('');
  const [originalText, setOriginalText] = useState('');
  const [pendingChanges, setPendingChanges] = useState<StyleChange[]>([]);
  const [canUndo, setCanUndo] = useState(false);

  const captureFrame = useCallback((): HistoryFrame => {
    const elements = Array.from(touchedRef.current);
    return {
      inline: captureInlineStyles(elements, [...STYLE_PROP_KEYS]),
      text:
        selectedElement && textKind !== 'none'
          ? captureTextSnapshot(selectedElement as HTMLElement, textKind)
          : null,
    };
  }, [selectedElement, textKind]);

  const pushUndo = useCallback(() => {
    undoStackRef.current.push(captureFrame());
    if (undoStackRef.current.length > MAX_UNDO) {
      undoStackRef.current.shift();
    }
    setCanUndo(undoStackRef.current.length > 0);
  }, [captureFrame]);

  const syncTargets = useCallback(
    (reapplyPending: boolean) => {
      if (!selectedElement) return;

      const prevTouched = Array.from(touchedRef.current);
      restoreInlineStyles(initialInlineRef.current.filter((s) => prevTouched.includes(s.element)));
      if (initialTextRef.current) {
        restoreTextSnapshot(initialTextRef.current);
      }

      const targets = getPreviewTargets(selectedElement, targetScope);
      targetsRef.current = targets;
      touchedRef.current = new Set(targets);

      clearTailwindStatePreview(prevTouched);
      applyTailwindStatePreview(targets, elementState);

      if (reapplyPending && pendingChanges.length > 0) {
        for (const change of pendingChanges) {
          if (change.property === 'textContent' || change.property === 'value') {
            for (const el of targets) {
              setEditableTextPreview(el, change.property as TextEditKind, change.newValue);
            }
          } else {
            for (const el of targets) {
              el.style.setProperty(change.property, change.newValue);
            }
          }
        }
      }
    },
    [selectedElement, targetScope, elementState, pendingChanges]
  );

  useEffect(() => {
    if (!selectedElement) {
      targetsRef.current = [];
      touchedRef.current = new Set();
      initialInlineRef.current = [];
      initialTextRef.current = null;
      undoStackRef.current = [];
      setValues({});
      setOriginalValues({});
      setTextKind('none');
      setTextValue('');
      setOriginalText('');
      setPendingChanges([]);
      setCanUndo(false);
      return;
    }

    const targets = getPreviewTargets(selectedElement, targetScope);
    targetsRef.current = targets;
    touchedRef.current = new Set(targets);
    initialInlineRef.current = captureInlineStyles(targets, [...STYLE_PROP_KEYS]);
    undoStackRef.current = [];
    setCanUndo(false);

    const styles = getRelevantComputedStyles(selectedElement);
    setValues(styles);
    setOriginalValues(styles);

    const textInfo = getEditableTextInfo(selectedElement);
    setTextKind(textInfo.kind);
    setTextValue(textInfo.value);
    setOriginalText(textInfo.value);
    initialTextRef.current =
      textInfo.kind !== 'none'
        ? captureTextSnapshot(selectedElement as HTMLElement, textInfo.kind)
        : null;

    setPendingChanges([]);
    applyTailwindStatePreview(targets, elementState);

    return () => clearTailwindStatePreview(targets);
  }, [selectedElement]);

  useEffect(() => {
    if (!selectedElement) return;
    syncTargets(true);
  }, [targetScope]);

  useEffect(() => {
    if (!selectedElement) return;
    const targets = getPreviewTargets(selectedElement, targetScope);
    targetsRef.current = targets;
    clearTailwindStatePreview(Array.from(touchedRef.current));
    applyTailwindStatePreview(targets, elementState);
    touchedRef.current = new Set(targets);
  }, [elementState, selectedElement, targetScope]);

  const upsertChange = useCallback((property: string, oldValue: string, newValue: string) => {
    setPendingChanges((prev) => {
      const filtered = prev.filter((c) => c.property !== property);
      if (newValue === oldValue) return filtered;
      return [...filtered, { property, oldValue, newValue }];
    });
  }, []);

  const updateProperty = useCallback(
    (property: string, newValue: string) => {
      if (!selectedElement) return;

      const batch: Record<string, string> = { [property]: newValue };
      if (
        property === 'border-width' &&
        (values['border-style'] ?? 'none') === 'none' &&
        hasPositiveBorderWidth(newValue)
      ) {
        batch['border-style'] = 'solid';
      }

      pushUndo();
      setValues((prev) => ({ ...prev, ...batch }));
      for (const [prop, val] of Object.entries(batch)) {
        const oldValue = originalValues[prop] ?? '';
        for (const el of targetsRef.current) {
          el.style.setProperty(prop, val);
          touchedRef.current.add(el);
        }
        upsertChange(prop, oldValue, val);
      }
    },
    [selectedElement, originalValues, values, pushUndo, upsertChange]
  );

  const updateText = useCallback(
    (newValue: string) => {
      if (!selectedElement || textKind === 'none') return;
      pushUndo();
      setTextValue(newValue);
      for (const el of targetsRef.current) {
        setEditableTextPreview(el, textKind, newValue);
        touchedRef.current.add(el);
      }
      upsertChange(textKind, originalText, newValue);
    },
    [selectedElement, textKind, originalText, pushUndo, upsertChange]
  );

  const undo = useCallback(() => {
    const frame = undoStackRef.current.pop();
    if (!frame) return;
    restoreInlineStyles(frame.inline);
    if (frame.text) restoreTextSnapshot(frame.text);
    setCanUndo(undoStackRef.current.length > 0);

    if (selectedElement) {
      setValues(getRelevantComputedStyles(selectedElement));
      const textInfo = getEditableTextInfo(selectedElement);
      if (textInfo.kind !== 'none') setTextValue(textInfo.value);
    }
  }, [selectedElement]);

  const reset = useCallback(() => {
    restoreInlineStyles(initialInlineRef.current);
    if (initialTextRef.current) restoreTextSnapshot(initialTextRef.current);
    undoStackRef.current = [];
    setCanUndo(false);
    setPendingChanges([]);
    if (selectedElement) {
      setValues(getRelevantComputedStyles(selectedElement));
      const textInfo = getEditableTextInfo(selectedElement);
      setTextValue(textInfo.value);
    }
  }, [selectedElement]);

  const revertPreviews = useCallback(() => {
    restoreInlineStyles(initialInlineRef.current);
    if (initialTextRef.current) restoreTextSnapshot(initialTextRef.current);
  }, []);

  const clearPreviews = useCallback(() => {
    revertPreviews();
    clearTailwindStatePreview(Array.from(touchedRef.current));
    undoStackRef.current = [];
    setCanUndo(false);
    setPendingChanges([]);
    if (selectedElement) {
      setValues(getRelevantComputedStyles(selectedElement));
      const textInfo = getEditableTextInfo(selectedElement);
      if (textInfo.kind !== 'none') setTextValue(textInfo.value);
    }
  }, [revertPreviews, selectedElement]);

  return {
    values,
    textKind,
    textValue,
    pendingChanges,
    canUndo,
    updateProperty,
    updateText,
    undo,
    reset,
    clearPreviews,
    revertPreviews,
  };
}
