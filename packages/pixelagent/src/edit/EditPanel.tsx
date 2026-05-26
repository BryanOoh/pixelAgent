import { useCallback, useEffect, useMemo } from 'react';
import type { ElementState, StyleChange, TargetScope } from '@pixelagent/shared';
import {
  countElementInstances,
  detectStylingSystem,
  getCssSelector,
  getElementDisplayLabel,
  getPreviewTargets,
  getScopeSelector,
  readReactSource,
} from '@pixelagent/shared';
import { ElementOverlay } from '../annotate/ElementOverlay';
import { GlassButton, GlassPanel } from '../glass';
import { useDraggable } from '../hooks/useDraggable';
import { IconReset, IconUndo } from './EditActionIcons';
import { EditPropertiesPanel } from './EditPropertiesPanel';
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
          !el.closest(
            '[data-pixelagent-root],[data-pixelagent-toolbar-portal],[data-pixelagent-picker-portal]'
          )
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
          !el.closest(
            '[data-pixelagent-root],[data-pixelagent-toolbar-portal],[data-pixelagent-picker-portal]'
          )
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
  const instanceCount = selectedElement ? countElementInstances(selectedElement) : 0;
  const scopeSelector = selectedElement
    ? getScopeSelector(selectedElement, 'all-instances')
    : '';

  const stateHint =
    elementState !== 'normal' && stylingSystem === 'tailwind'
      ? 'Tailwind variant preview: matching hover:/focus:/… classes are applied without the prefix.'
      : elementState !== 'normal'
        ? 'State preview uses focus/disabled simulation where possible.'
        : null;

  const scopeHint =
    instanceCount > 1
      ? targetScope === 'all-instances'
        ? `Preview & Apply on ${instanceCount} elements (${scopeSelector}).`
        : `This instance only — ${instanceCount - 1} other on page.`
      : targetScope === 'all-instances'
        ? 'Only one match — scope has no effect.'
        : null;

  const scopeMatchedElements = useMemo(() => {
    if (!selectedElement || targetScope !== 'all-instances') return [];
    return getPreviewTargets(selectedElement, 'all-instances');
  }, [selectedElement, targetScope]);

  return (
    <>
      <ElementOverlay
        element={targetScope === 'all-instances' ? null : hoveredElement}
        selected={selectedElement}
        multiSelected={scopeMatchedElements}
        primarySelected={selectedElement}
      />

      <div
        ref={panelRef}
        className={`pa-edit-panel-float ${isDragging ? 'pa-edit-panel-float--dragging' : ''}`}
        style={style}
      >
        <GlassPanel variant="sheet" side="right" className="pa-edit-panel-glass">
          <div className="pa-edit-panel-inner">
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
              <h3 className="pa-edit-title">Edit</h3>
            </div>

            {!selectedElement ? (
              <p className="pa-edit-hint">Click an element to edit its text and styles.</p>
            ) : (
              <>
                <div className="pa-edit-meta">
                  <code
                    className="pa-edit-meta-label"
                    title={`This instance: ${getCssSelector(selectedElement)}\nAll instances: ${scopeSelector}`}
                  >
                    {getElementDisplayLabel(selectedElement)}
                  </code>
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

                <div className="pa-edit-panel-scroll">
                  <EditPropertiesPanel
                    values={values}
                    onPropertyChange={updateProperty}
                    textKind={textKind}
                    textValue={textValue}
                    onTextChange={updateText}
                    targetScope={targetScope}
                    onTargetScopeChange={onTargetScopeChange}
                    elementState={elementState}
                    onElementStateChange={onElementStateChange}
                    instanceCount={instanceCount}
                    scopeHint={scopeHint}
                    stateHint={stateHint}
                  />
                </div>

                <div className="pa-edit-panel-sticky">
                  <div className="pa-edit-actions">
                    <GlassButton variant="regular" onClick={undo} disabled={!canUndo}>
                      <span className="pa-glass-btn-inner">
                        <IconUndo className="pa-glass-btn-icon" />
                        <span>Undo</span>
                      </span>
                    </GlassButton>
                    <GlassButton
                      variant="regular"
                      onClick={reset}
                      disabled={pendingChanges.length === 0}
                    >
                      <span className="pa-glass-btn-inner">
                        <IconReset className="pa-glass-btn-icon" />
                        <span>Reset</span>
                      </span>
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
                </div>
              </>
            )}
          </div>
        </GlassPanel>
      </div>
    </>
  );
}
