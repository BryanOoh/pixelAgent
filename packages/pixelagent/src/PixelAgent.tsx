import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  AnnotateCaptureMode,
  ApplyPayload,
  ApplyVisualDiffResult,
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
import { submitApply } from './edit/submitApply';
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
import pixelagentBaseCss from './styles/pixelagent.css?inline';

const BASE_STYLE_ELEMENT_ID = 'pixelagent-base-styles';

/**
 * Inject the toolbar's base stylesheet once, on import. Shipped inline in the
 * JS bundle so consumers don't need a separate `import 'pixelagent/style.css'`.
 * The UI portals into the light DOM (`document.body`), so a global <style> in
 * the head is what reaches it. Idempotent across HMR / multiple mounts; no-op
 * during SSR.
 */
function ensureBaseStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(BASE_STYLE_ELEMENT_ID)) return;
  const tag = document.createElement('style');
  tag.id = BASE_STYLE_ELEMENT_ID;
  tag.textContent = pixelagentBaseCss;
  document.head.appendChild(tag);
}

ensureBaseStyles();

export type PixelAgentMode = 'annotate' | 'edit' | 'idle';

export interface PixelAgentProps {
  /** Glass chrome + host theme sync; extend as new UI knobs ship. */
  ui?: PixelAgentUiSettings;
  /** Controlled host page theme (e.g. demo `data-theme`). */
  hostTheme?: HostTheme;
  onHostThemeChange?: (theme: HostTheme) => void;
  /**
   * Explicit POST endpoint for Apply. When unset, the component auto-probes
   * the standard Vite plugin path (`/__pixelagent/apply`) at mount; if that
   * fails it falls back to clipboard.
   */
  applyEndpoint?: string;
  /** Custom transport. Takes precedence over `applyEndpoint`. */
  onApply?: (payload: ApplyPayload) => Promise<ApplyVisualDiffResult | null>;
  /**
   * Demo mode: Apply writes normal-state edits as permanent inline styles and
   * non-normal-state edits into a managed `<style>` tag in `document.head`,
   * skipping the source-patching pipeline entirely. Useful when there's no
   * Vite dev server (e.g. a Vercel deployment) — changes look real in the
   * page but reset on reload. When this is on, `applyEndpoint`/`onApply`
   * are ignored.
   */
  runtimeStateStyles?: boolean;
}

const AUTO_APPLY_PATH = '/__pixelagent/apply';
const RUNTIME_STYLE_ELEMENT_ID = 'pixelagent-runtime-styles';
let runtimeClassCounter = 0;
const runtimeClassByElement = new WeakMap<Element, string>();

function getOrAssignRuntimeClass(element: Element): string {
  let cls = runtimeClassByElement.get(element);
  if (cls) return cls;
  // Re-use an existing pa-runtime-* class already on the element (e.g. after
  // a remount); otherwise mint a fresh one.
  for (const c of Array.from(element.classList)) {
    if (c.startsWith('pa-runtime-')) {
      runtimeClassByElement.set(element, c);
      return c;
    }
  }
  runtimeClassCounter += 1;
  cls = `pa-runtime-${runtimeClassCounter}`;
  runtimeClassByElement.set(element, cls);
  element.classList.add(cls);
  return cls;
}

function ensureRuntimeStyleTag(): HTMLStyleElement {
  let tag = document.getElementById(RUNTIME_STYLE_ELEMENT_ID) as HTMLStyleElement | null;
  if (!tag) {
    tag = document.createElement('style');
    tag.id = RUNTIME_STYLE_ELEMENT_ID;
    document.head.appendChild(tag);
  }
  return tag;
}

/**
 * Upsert `.<className>:<state> { property: value !important }` into the
 * runtime style tag. Existing properties on the same rule are updated in
 * place; new ones get appended inside the same block.
 */
function upsertRuntimeRule(
  className: string,
  state: string,
  property: string,
  newValue: string
) {
  const tag = ensureRuntimeStyleTag();
  const escaped = className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const ruleRegex = new RegExp(
    `(\\.${escaped}:${state}\\s*\\{)([\\s\\S]*?)(\\})`,
    'm'
  );
  const declaration = `${property}: ${newValue} !important`;
  let content = tag.textContent ?? '';
  const match = content.match(ruleRegex);
  if (match) {
    const inner = match[2];
    const propRegex = new RegExp(`(\\s*${property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:\\s*)[^;]+;?`);
    let nextInner: string;
    if (propRegex.test(inner)) {
      nextInner = inner.replace(propRegex, `$1${newValue} !important;`);
    } else {
      const trimmed = inner.replace(/\s+$/, '');
      const sep = trimmed.endsWith(';') || trimmed === '' ? '' : ';';
      nextInner = `${trimmed}${sep}\n  ${declaration};\n`;
    }
    content = content.replace(ruleRegex, `$1${nextInner}$3`);
  } else {
    if (content && !content.endsWith('\n')) content += '\n';
    content += `\n.${className}:${state} {\n  ${declaration};\n}\n`;
  }
  tag.textContent = content;
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

export function PixelAgent({
  ui,
  hostTheme,
  onHostThemeChange,
  applyEndpoint,
  onApply,
  runtimeStateStyles,
}: PixelAgentProps = {}) {
  const pixelAgentUi = usePixelAgentUi({ ui, hostTheme, onHostThemeChange });
  const [autoEndpoint, setAutoEndpoint] = useState<string | null>(null);

  // Auto-probe the Vite plugin endpoint. The plugin returns 405 for non-POST,
  // which uniquely confirms the middleware is mounted. 404 / network error → skip.
  useEffect(() => {
    if (applyEndpoint || onApply) return;
    let cancelled = false;
    fetch(AUTO_APPLY_PATH, { method: 'GET' })
      .then((res) => {
        if (!cancelled && res.status === 405) setAutoEndpoint(AUTO_APPLY_PATH);
      })
      .catch(() => {
        /* no plugin — clipboard fallback */
      });
    return () => {
      cancelled = true;
    };
  }, [applyEndpoint, onApply]);
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
    async (
      pendingByElement: Map<Element, Map<ElementState, ApplyPayload['changes']>>
    ): Promise<{ applied: boolean; skipRevert?: boolean }> => {
      const entries: Array<[Element, ElementState, ApplyPayload['changes']]> = [];
      for (const [element, stateMap] of pendingByElement) {
        for (const [state, changes] of stateMap) {
          if (changes.length > 0) entries.push([element, state, changes]);
        }
      }
      if (entries.length === 0) return { applied: false };

      if (runtimeStateStyles) {
        // Demo mode: commit non-normal edits via a managed <style> tag and
        // turn normal-state previews into permanent inline styles. Order
        // matters — non-normal cleanup must remove its hover preview before
        // we re-apply normal inline values on top.
        for (const [element, state, changes] of entries) {
          if (state === 'normal') continue;
          const cls = getOrAssignRuntimeClass(element);
          for (const c of changes) {
            (element as HTMLElement).style.removeProperty(c.property);
            upsertRuntimeRule(cls, state, c.property, c.newValue);
          }
        }
        for (const [element, state, changes] of entries) {
          if (state !== 'normal') continue;
          for (const c of changes) {
            (element as HTMLElement).style.setProperty(c.property, c.newValue);
          }
        }
        showCopyStatus('Change applied');
        return { applied: true, skipRevert: true };
      }

      const effectiveEndpoint = applyEndpoint ?? autoEndpoint ?? undefined;
      const results = [];
      for (const [element, state, changes] of entries) {
        const source = readReactSource(element);
        const payload: ApplyPayload = {
          schemaVersion: 1,
          elementSelector: getScopeSelector(element, targetScope),
          sourceFile: source.sourceFile,
          lineNumber: source.lineNumber,
          targetScope,
          state,
          stylingSystem: detectStylingSystem(element),
          changes,
        };
        results.push(await submitApply(payload, { applyEndpoint: effectiveEndpoint, onApply }));
      }

      const allApplied = results.every(
        (r) =>
          r.mode === 'mcp' && r.result.success && r.result.linesChanged.length > 0
      );
      showCopyStatus(allApplied ? 'Change applied' : 'Apply failed');

      // Surface per-payload detail to the console for debugging.
      results.forEach((r, i) => {
        if (r.mode === 'error') console.error(`[pixelagent] Apply #${i} failed:`, r.message);
        else if (r.mode === 'clipboard')
          console.warn(`[pixelagent] Apply #${i} fell back to clipboard`);
        else if (r.mode === 'mcp' && !r.result.success)
          console.warn(`[pixelagent] Apply #${i} reported no changes:`, r.result);
      });

      return { applied: allApplied };
    },
    [targetScope, applyEndpoint, autoEndpoint, onApply, runtimeStateStyles, showCopyStatus]
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
