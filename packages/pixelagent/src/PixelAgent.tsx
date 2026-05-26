import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  AnnotateCaptureMode,
  ApplyPayload,
  ElementState,
  HostTheme,
  PixelAgentUiSettings,
  TargetScope,
} from '@pixelagent/shared';
import {
  copyToClipboard,
  detectStylingSystem,
  formatAllAnnotations,
  formatAnnotation,
  countElementInstances,
  getScopeSelector,
  getElementsInArea,
  readReactSource,
} from '@pixelagent/shared';
import { EditPanel } from './edit/EditPanel';
import { AnnotationPopover } from './annotate/AnnotationPopover';
import { AreaSelectOverlay } from './annotate/AreaSelectOverlay';
import { buildAnnotationEntry } from './annotate/buildAnnotationEntry';
import { AnnotationBadgesOverlay } from './annotate/AnnotationBadgesOverlay';
import { ElementOverlay } from './annotate/ElementOverlay';
import { isPixelAgentElement, pickElementAt, PA_OWN_SELECTOR } from './annotate/pickElement';
import { SessionPanel } from './annotate/SessionPanel';
import { Toolbar } from './shadow/Toolbar';
import { useAnnotationSession } from './hooks/useAnnotationSession';
import { usePixelAgentUi } from './ui/usePixelAgentUi';
import './styles/pixelagent.css';

export type PixelAgentMode = 'annotate' | 'edit' | 'idle';

export interface PixelAgentProps {
  /** Glass chrome + host theme sync; extend as new UI knobs ship. */
  ui?: PixelAgentUiSettings;
  /** Controlled host page theme (e.g. demo `data-theme`). */
  hostTheme?: HostTheme;
  onHostThemeChange?: (theme: HostTheme) => void;
}

interface AreaDragState {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

interface PendingAnnotation {
  elements: Element[];
  areaBbox?: { x: number; y: number; width: number; height: number };
}

function normalizeAreaRect(drag: AreaDragState) {
  const x = Math.min(drag.startX, drag.currentX);
  const y = Math.min(drag.startY, drag.currentY);
  const width = Math.abs(drag.currentX - drag.startX);
  const height = Math.abs(drag.currentY - drag.startY);
  return { x, y, width, height };
}

export function PixelAgent({ ui, hostTheme, onHostThemeChange }: PixelAgentProps = {}) {
  const pixelAgentUi = usePixelAgentUi({ ui, hostTheme, onHostThemeChange });
  const [active, setActive] = useState(false);
  const [mode, setMode] = useState<PixelAgentMode>('idle');
  const [captureMode, setCaptureMode] = useState<AnnotateCaptureMode>('element');
  const {
    annotations,
    setAnnotations,
    updateAnnotation,
    removeAnnotation,
  } = useAnnotationSession();

  const [hoveredElement, setHoveredElement] = useState<Element | null>(null);
  const [selectedElement, setSelectedElement] = useState<Element | null>(null);
  const [multiSelected, setMultiSelected] = useState<Element[]>([]);
  const [pendingAnnotation, setPendingAnnotation] = useState<PendingAnnotation | null>(null);
  const [areaDrag, setAreaDrag] = useState<AreaDragState | null>(null);
  const [sessionDismissed, setSessionDismissed] = useState(false);
  const [sessionCollapsed, setSessionCollapsed] = useState(false);

  const sessionVisible =
    active && mode === 'annotate' && annotations.length > 0 && !sessionDismissed;
  const [targetScope, setTargetScope] = useState<TargetScope>('this-instance');
  const [elementState, setElementState] = useState<ElementState>('normal');
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [copiedEntryId, setCopiedEntryId] = useState<string | null>(null);
  const [copyAllFrom, setCopyAllFrom] = useState<'toolbar' | 'session' | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const copyStatusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showCopyStatus = useCallback(
    (message: string, options?: { entryId?: string; copyAllFrom?: 'toolbar' | 'session' }) => {
      if (copyStatusTimer.current) clearTimeout(copyStatusTimer.current);
      setCopyStatus(message);
      setCopiedEntryId(options?.entryId ?? null);
      setCopyAllFrom(options?.copyAllFrom ?? null);
      copyStatusTimer.current = setTimeout(() => {
        setCopyStatus(null);
        setCopiedEntryId(null);
        setCopyAllFrom(null);
      }, 2500);
    },
    []
  );

  const copyText = useCallback(
    async (
      text: string,
      successMessage: string,
      options?: { entryId?: string; copyAllFrom?: 'toolbar' | 'session' }
    ) => {
      if (!text) return;
      try {
        await copyToClipboard(text);
        showCopyStatus(successMessage, options);
      } catch {
        showCopyStatus('Copy failed — check clipboard permissions', options);
      }
    },
    [showCopyStatus]
  );

  const openAnnotationPopover = useCallback(
    (elements: Element[], areaBbox?: PendingAnnotation['areaBbox']) => {
      if (elements.length === 0 && !areaBbox) return;
      setPendingAnnotation({ elements, areaBbox });
      setSelectedElement(elements[0] ?? null);
    },
    []
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!active || mode !== 'annotate' || isPixelAgentElement(e.target)) return;

      if (areaDrag) {
        setAreaDrag((prev) =>
          prev ? { ...prev, currentX: e.clientX, currentY: e.clientY } : prev
        );
        return;
      }

      if (captureMode !== 'area') {
        setHoveredElement(pickElementAt(e.clientX, e.clientY));
      }
    },
    [active, mode, areaDrag, captureMode]
  );

  const handleMouseDown = useCallback(
    (e: MouseEvent) => {
      if (!active || mode !== 'annotate' || isPixelAgentElement(e.target)) return;
      if (captureMode !== 'area' || e.button !== 0) return;

      e.preventDefault();
      e.stopPropagation();
      setAreaDrag({
        startX: e.clientX,
        startY: e.clientY,
        currentX: e.clientX,
        currentY: e.clientY,
      });
      setPendingAnnotation(null);
    },
    [active, mode, captureMode]
  );

  const handleMouseUp = useCallback(() => {
      if (!areaDrag) return;

      const area = normalizeAreaRect(areaDrag);
      setAreaDrag(null);

      if (area.width < 8 || area.height < 8) return;

      const elements = getElementsInArea(area, PA_OWN_SELECTOR);
    openAnnotationPopover(elements, area);
  }, [areaDrag, openAnnotationPopover]);

  const handleClick = useCallback(
    (e: MouseEvent) => {
      if (!active || mode !== 'annotate' || isPixelAgentElement(e.target)) return;
      if (captureMode === 'area') return;

      e.preventDefault();
      e.stopPropagation();

      const target = pickElementAt(e.clientX, e.clientY);
      if (!target) return;

      if (e.shiftKey || captureMode === 'multi') {
        setMultiSelected((prev) => {
          const exists = prev.includes(target);
          return exists ? prev.filter((el) => el !== target) : [...prev, target];
        });
        setSelectedElement(target);
        return;
      }

      const elements = multiSelected.length > 0 ? multiSelected : [target];
      openAnnotationPopover(elements.includes(target) ? elements : [target]);
    },
    [active, mode, captureMode, multiSelected, openAnnotationPopover]
  );

  useEffect(() => {
    if (!selectedElement || targetScope !== 'all-instances') return;
    if (countElementInstances(selectedElement) <= 1) {
      setTargetScope('this-instance');
    }
  }, [selectedElement, targetScope]);

  useEffect(() => {
    if (!active) return;

    document.addEventListener('mousemove', handleMouseMove, true);
    document.addEventListener('mousedown', handleMouseDown, true);
    document.addEventListener('mouseup', handleMouseUp, true);
    document.addEventListener('click', handleClick, true);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove, true);
      document.removeEventListener('mousedown', handleMouseDown, true);
      document.removeEventListener('mouseup', handleMouseUp, true);
      document.removeEventListener('click', handleClick, true);
    };
  }, [active, handleMouseMove, handleMouseDown, handleMouseUp, handleClick]);

  const addAnnotation = useCallback(
    (note: string, continuous: boolean) => {
      if (!pendingAnnotation || !note.trim()) return;

      const { elements, areaBbox } = pendingAnnotation;
      if (elements.length === 0 && !areaBbox) return;

      const entry = buildAnnotationEntry({
        elements,
        note,
        areaBbox,
      });

      setAnnotations((prev) => [...prev, entry]);
      setSessionDismissed(false);
      setSessionCollapsed(false);

      if (continuous) {
        setPendingAnnotation(null);
        setSelectedElement(null);
      } else {
        setPendingAnnotation(null);
        setSelectedElement(null);
        setMultiSelected([]);
      }
    },
    [pendingAnnotation, setAnnotations]
  );

  const cancelAnnotation = useCallback(() => {
    setPendingAnnotation(null);
    setSelectedElement(null);
  }, []);

  const copyAllAnnotations = useCallback(
    async (from: 'toolbar' | 'session') => {
      const markdown = formatAllAnnotations(annotations);
      await copyText(markdown, 'Copied all!', { copyAllFrom: from });
    },
    [annotations, copyText]
  );

  const copyOneAnnotation = useCallback(
    async (id: string) => {
      const entry = annotations.find((a) => a.id === id);
      if (!entry) return;
      await copyText(formatAnnotation(entry), 'Copied!', { entryId: id });
    },
    [annotations, copyText]
  );

  const handleApply = useCallback(
    async (changes: ApplyPayload['changes']) => {
      if (!selectedElement) return;

      const source = readReactSource(selectedElement);
      const payload: ApplyPayload = {
        schemaVersion: 1,
        elementSelector: getScopeSelector(selectedElement, targetScope),
        sourceFile: source.sourceFile,
        lineNumber: source.lineNumber,
        targetScope,
        state: elementState,
        stylingSystem: detectStylingSystem(selectedElement),
        changes,
      };

      await copyText(JSON.stringify(payload, null, 2), 'Apply payload copied!');
    },
    [selectedElement, targetScope, elementState, copyText]
  );

  const activateMode = (nextMode: PixelAgentMode) => {
    pixelAgentUi.setSettingsOpen(false);
    setActive(true);
    setMode(nextMode);
    setSelectedElement(null);
    setHoveredElement(null);
    setPendingAnnotation(null);
    setMultiSelected([]);
    setAreaDrag(null);
    if (nextMode === 'annotate') setSessionDismissed(false);
  };

  const deactivate = () => {
    setActive(false);
    setMode('idle');
    setSelectedElement(null);
    setHoveredElement(null);
    setPendingAnnotation(null);
    setMultiSelected([]);
    setAreaDrag(null);
    setSessionDismissed(false);
    setSessionCollapsed(false);
  };

  const areaRect = areaDrag ? normalizeAreaRect(areaDrag) : null;

  return (
    <div
      ref={containerRef}
      className="pa-root"
      data-pixelagent-root
      {...pixelAgentUi.rootAttributes}
    >
      <Toolbar
        rootAttributes={pixelAgentUi.rootAttributes}
        hostTheme={pixelAgentUi.hostTheme}
        chrome={pixelAgentUi.chrome}
        settingsOpen={pixelAgentUi.settingsOpen}
        onToggleSettings={pixelAgentUi.toggleSettings}
        onCloseSettings={() => pixelAgentUi.setSettingsOpen(false)}
        onToggleHostTheme={pixelAgentUi.toggleHostTheme}
        active={active}
        mode={mode}
        captureMode={captureMode}
        annotationCount={annotations.length}
        multiSelectCount={multiSelected.length}
        copyStatus={copyStatus}
        copyAllFrom={copyAllFrom}
        onActivateAnnotate={() => activateMode('annotate')}
        onActivateEdit={() => activateMode('edit')}
        onDeactivate={deactivate}
        onCopyAll={() => copyAllAnnotations('toolbar')}
        onCaptureModeChange={setCaptureMode}
        onConfirmMultiSelect={() => {
          if (multiSelected.length > 0) openAnnotationPopover(multiSelected);
        }}
      />

      {active && mode === 'annotate' && (
        <>
          <ElementOverlay
            element={hoveredElement}
            selected={selectedElement}
            multiSelected={multiSelected}
          />
          <AnnotationBadgesOverlay annotations={annotations} />
          <AreaSelectOverlay area={areaRect} isDragging={!!areaDrag} />
        </>
      )}

      {active && mode === 'annotate' && pendingAnnotation && (
        <AnnotationPopover
          elements={pendingAnnotation.elements}
          areaBbox={pendingAnnotation.areaBbox}
          onSubmit={addAnnotation}
          onCancel={cancelAnnotation}
        />
      )}

      {active && mode === 'edit' && (
        <EditPanel
          selectedElement={selectedElement}
          hoveredElement={hoveredElement}
          onSelectElement={setSelectedElement}
          onHoverElement={setHoveredElement}
          targetScope={targetScope}
          onTargetScopeChange={setTargetScope}
          elementState={elementState}
          onElementStateChange={setElementState}
          onApply={handleApply}
          applyStatus={mode === 'edit' ? copyStatus : null}
          isToolbarTarget={isPixelAgentElement}
        />
      )}

      {sessionVisible && (
        <SessionPanel
          annotations={annotations}
          collapsed={sessionCollapsed}
          onToggleCollapsed={() => setSessionCollapsed((c) => !c)}
          onClose={() => {
            setSessionDismissed(true);
            setSessionCollapsed(false);
          }}
          onCopyAll={() => copyAllAnnotations('session')}
          onCopyOne={copyOneAnnotation}
          onRemove={removeAnnotation}
          onUpdate={updateAnnotation}
          copyStatus={copyStatus}
          copiedEntryId={copiedEntryId}
          copyAllFrom={copyAllFrom}
        />
      )}
    </div>
  );
}

export { PixelAgent as default };
