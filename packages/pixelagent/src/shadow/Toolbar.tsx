import { createPortal } from 'react-dom';
import type { AnnotateCaptureMode, HostTheme, PixelAgentChrome } from '@pixelagent/shared';
import type { PixelAgentMode } from '../PixelAgent';
import { GlassButton, GlassSurface } from '../glass';
import { useDraggable } from '../hooks/useDraggable';
import { SettingsIcon } from '../ui/icons';
import { ToolbarSettingsMenu } from '../ui/ToolbarSettingsMenu';
import { CopyFeedbackSlot, isCopyAllFeedback } from '../ui/CopyFeedbackSlot';
import { PixelAgentIcon } from './PixelAgentIcon';

interface ToolbarProps {
  rootAttributes: Record<string, string>;
  hostTheme: HostTheme;
  chrome: PixelAgentChrome;
  settingsOpen: boolean;
  onToggleSettings: () => void;
  onCloseSettings: () => void;
  onToggleHostTheme: () => void;
  active: boolean;
  mode: PixelAgentMode;
  captureMode: AnnotateCaptureMode;
  annotationCount: number;
  multiSelectCount: number;
  copyStatus: string | null;
  copyAllFrom: 'toolbar' | 'session' | null;
  onActivateAnnotate: () => void;
  onActivateEdit: () => void;
  onDeactivate: () => void;
  onCopyAll: () => void;
  onCaptureModeChange: (mode: AnnotateCaptureMode) => void;
  onConfirmMultiSelect: () => void;
}

const CAPTURE_OPTIONS: AnnotateCaptureMode[] = ['element', 'area', 'multi'];

const CAPTURE_LABELS: Record<AnnotateCaptureMode, string> = {
  element: 'Click',
  area: 'Area',
  multi: 'Multi',
};

export function Toolbar({
  rootAttributes,
  hostTheme,
  chrome,
  settingsOpen,
  onToggleSettings,
  onCloseSettings,
  onToggleHostTheme,
  active,
  mode,
  captureMode,
  annotationCount,
  multiSelectCount,
  copyStatus,
  copyAllFrom,
  onActivateAnnotate,
  onActivateEdit,
  onDeactivate,
  onCopyAll,
  onCaptureModeChange,
  onConfirmMultiSelect,
}: ToolbarProps) {
  const { elementRef, isDragging, style, dragHandleProps } = useDraggable();
  const toolbar = (
    <div
      ref={elementRef}
      className={`pa-toolbar-float ${isDragging ? 'pa-toolbar-float--dragging' : ''}`}
      style={style}
      role="toolbar"
      aria-label="PixelAgent"
    >
      {!active && (
        <ToolbarSettingsMenu
          open={settingsOpen}
          onClose={onCloseSettings}
          hostTheme={hostTheme}
          chrome={chrome}
          onToggleHostTheme={onToggleHostTheme}
        />
      )}

      <GlassSurface shape="capsule" className="pa-toolbar-glass" intensity="enhanced">
        <div className="pa-toolbar-inner">
          <button
            type="button"
            className="pa-toolbar-drag"
            aria-label="Drag PixelAgent toolbar"
            title="Drag to move"
            {...dragHandleProps}
          >
            <PixelAgentIcon size={22} />
          </button>

          <span className="pa-toolbar-divider" aria-hidden="true" />

          {!active ? (
            <div className="pa-toolbar-segment">
              <GlassButton onClick={onActivateAnnotate}>Annotate</GlassButton>
              <GlassButton onClick={onActivateEdit}>Edit</GlassButton>
            </div>
          ) : (
            <>
              <div className="pa-toolbar-segment">
                <span className="pa-mode-badge">{mode}</span>
                {mode === 'annotate' && (
                  <>
                    <select
                      className="pa-select pa-toolbar-capture-select"
                      value={captureMode}
                      onChange={(e) =>
                        onCaptureModeChange(e.target.value as AnnotateCaptureMode)
                      }
                      aria-label="Capture mode"
                    >
                      {CAPTURE_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {CAPTURE_LABELS[option]}
                        </option>
                      ))}
                    </select>
                    {multiSelectCount > 0 && (
                      <GlassButton
                        variant="glass-primary"
                        onClick={onConfirmMultiSelect}
                        aria-label="Annotate selected elements"
                      >
                        {multiSelectCount}
                      </GlassButton>
                    )}
                    <CopyFeedbackSlot
                      feedback={
                        copyAllFrom === 'toolbar' ? copyStatus : null
                      }
                      slotClassName="pa-copy-feedback-slot--toolbar"
                    >
                      <GlassButton
                        variant="glass-primary"
                        onClick={onCopyAll}
                        disabled={annotationCount === 0}
                        aria-label={
                          annotationCount > 0
                            ? `Copy all annotations (${annotationCount})`
                            : 'Copy all annotations'
                        }
                      >
                        {annotationCount > 0 ? `Copy (${annotationCount})` : 'Copy'}
                      </GlassButton>
                    </CopyFeedbackSlot>
                  </>
                )}
              </div>

              <GlassButton
                variant="icon"
                className="pa-toolbar-close"
                onClick={onDeactivate}
                aria-label="Close"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M3 3L11 11M11 3L3 11"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                  />
                </svg>
              </GlassButton>
            </>
          )}

          {!active && (
            <>
              <span className="pa-toolbar-divider" aria-hidden="true" />

              <GlassButton
                variant="icon"
                className="pa-toolbar-settings"
                data-pa-settings-trigger
                onClick={onToggleSettings}
                aria-label="PixelAgent settings"
                aria-expanded={settingsOpen}
                title="Settings"
              >
                <SettingsIcon />
              </GlassButton>
            </>
          )}

          {copyStatus && !isCopyAllFeedback(copyStatus) && copyStatus !== 'Copied!' && (
            <span className="pa-status pa-toolbar-status" role="status">
              {copyStatus}
            </span>
          )}
        </div>
      </GlassSurface>
    </div>
  );

  if (typeof document === 'undefined') return toolbar;
  return createPortal(
    <div
      className="pa-root pa-root--toolbar-portal"
      data-pixelagent-toolbar-portal
      {...rootAttributes}
    >
      {toolbar}
    </div>,
    document.body
  );
}
