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
  readStateRuleDeclarations,
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
  // Tracks the (element, state) pair the state-change effect last serviced
  // so we can distinguish "user toggled the state" from "selectedElement
  // just changed". Without this, the state effect overwrites the fresh
  // values from the selection effect with stale originalValues.
  const lastStateContextRef = useRef<{ element: Element | null; state: ElementState } | null>(
    null
  );

  const [values, setValues] = useState<Record<string, string>>({});
  const [originalValues, setOriginalValues] = useState<Record<string, string>>({});
  const [textKind, setTextKind] = useState<TextEditKind>('none');
  const [textValue, setTextValue] = useState('');
  const [originalText, setOriginalText] = useState('');
  // Pending changes are keyed by (element, state). Switching layers preserves
  // edits across elements; switching the pseudo-state on a layer preserves
  // each state's edits so hover changes don't bleed into the normal-state
  // payload. The badge sums across every (element, state) bucket; Apply
  // dispatches one payload per bucket.
  const [pendingByElement, setPendingByElement] = useState<
    Map<Element, Map<ElementState, StyleChange[]>>
  >(() => new Map());
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

      const currentPending = selectedElement
        ? (pendingByElement.get(selectedElement)?.get(elementState) ?? [])
        : [];
      if (reapplyPending && currentPending.length > 0) {
        for (const change of currentPending) {
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
    [selectedElement, targetScope, elementState, pendingByElement]
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
      setPendingByElement(new Map());
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

    // Intentionally NOT clearing pendingByElement on element switch — pending
    // edits on other elements stay tracked so the badge accumulates across
    // layers and switching back restores in-progress work.
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

    // Drop the previous state's inline preview (so hover edits don't bleed
    // into the normal-state DOM when the user toggles back), then re-apply
    // whatever the new state has pending. Normal-state pending becomes the
    // resting inline preview; hover/focus/etc. pending shows the element as
    // though it's in that state while editing.
    restoreInlineStyles(
      initialInlineRef.current.filter((s) => targets.includes(s.element))
    );

    // Read the resting baseline AFTER the revert but BEFORE we apply any
    // state overlay, so the panel display starts from real computed styles
    // for the current element (avoids stale-originalValues races).
    const baseline = getRelevantComputedStyles(selectedElement);

    // Pull `:state` rule declarations from the page's stylesheets so the
    // user sees the element rendered as if in that state, and so the panel
    // reflects e.g. an existing `:hover { background: red }` before they
    // even start editing.
    const stateRules =
      elementState === 'normal'
        ? {}
        : readStateRuleDeclarations(selectedElement, elementState);
    for (const [prop, val] of Object.entries(stateRules)) {
      for (const el of targets) el.style.setProperty(prop, val);
    }

    const pendingForState =
      pendingByElement.get(selectedElement)?.get(elementState) ?? [];
    for (const change of pendingForState) {
      if (change.property === 'textContent' || change.property === 'value') continue;
      for (const el of targets) {
        el.style.setProperty(change.property, change.newValue);
      }
    }

    // Reset panel values when the user toggled state on the same element,
    // OR when they switched to a different element while a non-normal state
    // is active (so the new element's :state styling shows up). On a fresh
    // selection in normal state, defer to the selection effect's setValues
    // so it isn't fighting with this one.
    const ctx = lastStateContextRef.current;
    const stateChanged =
      ctx !== null && ctx.element === selectedElement && ctx.state !== elementState;
    const elementChangedInNonNormal =
      ctx !== null && ctx.element !== selectedElement && elementState !== 'normal';
    if (stateChanged || elementChangedInNonNormal) {
      const nextValues: Record<string, string> = { ...baseline, ...stateRules };
      for (const change of pendingForState) {
        if (change.property === 'textContent' || change.property === 'value') continue;
        nextValues[change.property] = change.newValue;
      }
      setValues(nextValues);
    }
    lastStateContextRef.current = { element: selectedElement, state: elementState };

    clearTailwindStatePreview(Array.from(touchedRef.current));
    applyTailwindStatePreview(targets, elementState);
    touchedRef.current = new Set(targets);
    // pendingByElement intentionally omitted — updateProperty applies new
    // edits inline directly, so re-running this effect on every keystroke
    // would just flicker.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elementState, selectedElement, targetScope]);

  const upsertChange = useCallback(
    (property: string, oldValue: string, newValue: string) => {
      if (!selectedElement) return;
      setPendingByElement((prev) => {
        const next = new Map(prev);
        const stateMap = new Map(next.get(selectedElement) ?? new Map<ElementState, StyleChange[]>());
        const existing = stateMap.get(elementState) ?? [];
        const filtered = existing.filter((c) => c.property !== property);
        if (newValue === oldValue) {
          if (filtered.length === 0) stateMap.delete(elementState);
          else stateMap.set(elementState, filtered);
        } else {
          stateMap.set(elementState, [...filtered, { property, oldValue, newValue }]);
        }
        if (stateMap.size === 0) next.delete(selectedElement);
        else next.set(selectedElement, stateMap);
        return next;
      });
    },
    [selectedElement, elementState]
  );

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
    setPendingByElement(new Map());
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
    setPendingByElement(new Map());
    if (selectedElement) {
      setValues(getRelevantComputedStyles(selectedElement));
      const textInfo = getEditableTextInfo(selectedElement);
      if (textInfo.kind !== 'none') setTextValue(textInfo.value);
    }
  }, [revertPreviews, selectedElement]);

  const currentPending = selectedElement
    ? (pendingByElement.get(selectedElement)?.get(elementState) ?? [])
    : [];

  let totalPendingCount = 0;
  for (const stateMap of pendingByElement.values()) {
    for (const arr of stateMap.values()) totalPendingCount += arr.length;
  }

  const clearAllPending = useCallback(() => {
    setPendingByElement(new Map());
  }, []);

  return {
    values,
    textKind,
    textValue,
    pendingChanges: currentPending,
    pendingByElement,
    totalPendingCount,
    clearAllPending,
    canUndo,
    updateProperty,
    updateText,
    undo,
    reset,
    clearPreviews,
    revertPreviews,
  };
}
