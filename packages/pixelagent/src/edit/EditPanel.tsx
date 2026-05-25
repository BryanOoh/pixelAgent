import { useCallback, useEffect } from 'react';
import type { ElementState, StyleChange, TargetScope } from '@pixelagent/shared';
import {
  detectStylingSystem,
  getCssSelector,
  readReactSource,
} from '@pixelagent/shared';
import { ElementOverlay } from '../annotate/ElementOverlay';
import { GlassButton, GlassPanel } from '../glass';
import { useDraggable } from '../hooks/useDraggable';
import { PropertyField } from './PropertyField';
import type { EditPreviewApi } from './useEditPreview';
import { useEditPreview } from './useEditPreview';

interface EditPanelProps {
  selectedElement: Element | null;
  hoveredElement: Element | null;
  onSelectElement: (el: Element | null) => void;
  onHoverElement: (el: Element | null) => void;
  targetScope: TargetScope;
  onTargetScopeChange: (scope: TargetScope) => void;
  elementState: ElementState;
  onElementStateChange: (state: ElementState) => void;
  onApply: (changes: StyleChange[]) => void | Promise<void>;
  applyStatus: string | null;
  isToolbarTarget: (target: EventTarget | null) => boolean;
  onPreviewApi?: (api: EditPreviewApi | null) => void;
}

const EDITABLE_PROPS = [
  { key: 'padding', label: 'Padding' },
  { key: 'margin', label: 'Margin' },
  { key: 'width', label: 'Width' },
  { key: 'height', label: 'Height' },
  { key: 'background-color', label: 'Background' },
  { key: 'color', label: 'Color' },
  { key: 'font-size', label: 'Font size' },
  { key: 'border-radius', label: 'Border radius' },
  { key: 'opacity', label: 'Opacity' },
] as const;

export function EditPanel({
  selectedElement,
  hoveredElement,
  onSelectElement,
  onHoverElement,
  targetScope,
  onTargetScopeChange,
  elementState,
  onElementStateChange,
  onApply,
  applyStatus,
  isToolbarTarget,
  onPreviewApi,
}: EditPanelProps) {
  const {
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
  } = useEditPreview(selectedElement, targetScope, elementState);

  const { elementRef: panelRef, isDragging, style, dragHandleProps } = useDraggable({
    computeDefaultPosition: (rect) => ({
      x: window.innerWidth - rect.width - 16,
      y: 16,
    }),
  });

  useEffect(() => {
    onPreviewApi?.({ clearPreviews, revertPreviews });
    return () => onPreviewApi?.(null);
  }, [onPreviewApi, clearPreviews, revertPreviews]);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (isToolbarTarget(e.target)) return;

      const elements = document.elementsFromPoint(e.clientX, e.clientY);
      const target = elements.find(
        (el) =>
          el instanceof Element &&
          !el.closest('[data-pixelagent-root],[data-pixelagent-toolbar-portal]')
      );
      onHoverElement(target ?? null);
    },
    [isToolbarTarget, onHoverElement]
  );

  const handleClick = useCallback(
    (e: MouseEvent) => {
      if (isToolbarTarget(e.target)) return;

      e.preventDefault();
      e.stopPropagation();

      const elements = document.elementsFromPoint(e.clientX, e.clientY);
      const target = elements.find(
        (el) =>
          el instanceof Element &&
          !el.closest('[data-pixelagent-root],[data-pixelagent-toolbar-portal]')
      );
      onSelectElement(target ?? null);
    },
    [isToolbarTarget, onSelectElement]
  );

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove, true);
    document.addEventListener('click', handleClick, true);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove, true);
      document.removeEventListener('click', handleClick, true);
    };
  }, [handleMouseMove, handleClick]);

  const handleApply = () => {
    if (pendingChanges.length === 0) return;
    onApply(pendingChanges);
  };

  const source = selectedElement ? readReactSource(selectedElement) : null;
  const stylingSystem = selectedElement ? detectStylingSystem(selectedElement) : null;
  const affectedCount =
    selectedElement && targetScope === 'all-instances'
      ? document.querySelectorAll(getCssSelector(selectedElement)).length
      : 1;

  const stateHint =
    elementState !== 'normal' && stylingSystem === 'tailwind'
      ? 'Tailwind variant preview: matching hover:/focus:/… classes are applied without the prefix.'
      : elementState !== 'normal'
        ? 'State preview uses focus/disabled simulation where possible.'
        : null;

  return (
    <>
      <ElementOverlay element={hoveredElement} selected={selectedElement} />

      <div
        ref={panelRef}
        className={`pa-edit-panel-float ${isDragging ? 'pa-edit-panel-float--dragging' : ''}`}
        style={style}
      >
        <GlassPanel variant="sheet" side="right" className="pa-edit-panel-glass">
          <div className="pa-edit-panel-header">
            <button
              type="button"
              className="pa-edit-panel-drag"
              aria-label="Drag edit panel"
              title="Drag to move"
              {...dragHandleProps}
            >
              <span className="pa-edit-panel-grip" aria-hidden="true">
                <span /><span /><span /><span /><span /><span />
              </span>
            </button>
            <h3 className="pa-edit-title">Edit panel</h3>
          </div>

          {!selectedElement ? (
            <p className="pa-edit-hint">Click an element to edit its text and styles.</p>
          ) : (
            <>
              <div className="pa-edit-meta">
                <code>{getCssSelector(selectedElement)}</code>
                {(source?.sourceFile || stylingSystem) && (
                  <span className="pa-edit-source">
                    {source?.sourceFile && (
                      <>
                        {source.sourceFile}
                        {source.lineNumber ? `:${source.lineNumber}` : ''}
                      </>
                    )}
                    {source?.sourceFile && stylingSystem ? ' · ' : ''}
                    {stylingSystem ?? ''}
                  </span>
                )}
              </div>

              <div className="pa-edit-controls">
                <label className="pa-label">
                  Scope
                  <select
                    className="pa-select"
                    value={targetScope}
                    onChange={(e) =>
                      onTargetScopeChange(e.target.value as TargetScope)
                    }
                  >
                    <option value="this-instance">This instance</option>
                    <option value="all-instances">
                      All instances ({affectedCount})
                    </option>
                  </select>
                </label>

                <label className="pa-label">
                  State
                  <select
                    className="pa-select"
                    value={elementState}
                    onChange={(e) =>
                      onElementStateChange(e.target.value as ElementState)
                    }
                  >
                    <option value="normal">Normal</option>
                    <option value="hover">Hover</option>
                    <option value="focus">Focus</option>
                    <option value="active">Active</option>
                    <option value="disabled">Disabled</option>
                  </select>
                </label>
              </div>

              {stateHint && <p className="pa-edit-state-hint">{stateHint}</p>}

              {textKind !== 'none' && (
                <div className="pa-edit-text-section">
                  <label className="pa-label">
                    Text
                    <textarea
                      className="pa-textarea pa-edit-text-input"
                      value={textValue}
                      onChange={(e) => updateText(e.target.value)}
                      rows={textKind === 'value' ? 2 : 3}
                      placeholder="Edit visible text…"
                    />
                  </label>
                </div>
              )}

              <div className="pa-edit-props">
                {EDITABLE_PROPS.map(({ key, label }) => (
                  <PropertyField
                    key={key}
                    property={key}
                    label={label}
                    value={values[key] ?? ''}
                    onChange={(v) => updateProperty(key, v)}
                  />
                ))}
              </div>

              <div className="pa-edit-actions">
                <GlassButton variant="regular" onClick={undo} disabled={!canUndo}>
                  Undo
                </GlassButton>
                <GlassButton variant="regular" onClick={reset} disabled={pendingChanges.length === 0}>
                  Reset
                </GlassButton>
              </div>

              <div className="pa-edit-footer">
                <span className="pa-change-count">
                  {applyStatus ??
                    `${pendingChanges.length} pending change${pendingChanges.length !== 1 ? 's' : ''}`}
                </span>
                <GlassButton
                  variant="glass-primary"
                  onClick={handleApply}
                  disabled={pendingChanges.length === 0 || !source?.sourceFile}
                >
                  Apply
                </GlassButton>
              </div>
            </>
          )}
        </GlassPanel>
      </div>
    </>
  );
}
