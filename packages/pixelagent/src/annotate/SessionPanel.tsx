import { useEffect, useState } from 'react';
import type { AnnotationEntry } from '@pixelagent/shared';
import { getAnnotationSessionDisplay } from '@pixelagent/shared';
import { GlassButton, GlassPanel } from '../glass';
import { useDraggable } from '../hooks/useDraggable';
import { CopyFeedbackSlot } from '../ui/CopyFeedbackSlot';
import { TrashIcon } from '../ui/icons';

interface SessionPanelProps {
  annotations: AnnotationEntry[];
  onClose: () => void;
  onCopyAll: () => void | Promise<void>;
  onCopyOne: (id: string) => void | Promise<void>;
  onRemove: (id: string) => void;
  onUpdate: (id: string, patch: Partial<AnnotationEntry>) => void;
  activeId: string | null;
  onActiveChange: (id: string | null) => void;
  copyStatus: string | null;
  copiedEntryId: string | null;
  copyAllFrom: 'toolbar' | 'session' | null;
}

export function SessionPanel({
  annotations,
  onClose,
  onCopyAll,
  onCopyOne,
  onRemove,
  onUpdate,
  activeId,
  onActiveChange,
  copyStatus,
  copiedEntryId,
  copyAllFrom,
}: SessionPanelProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftNote, setDraftNote] = useState('');

  const { elementRef: panelRef, isDragging, style, dragHandleProps } = useDraggable({
    computeDefaultPosition: (rect) => ({
      x: window.innerWidth - rect.width - 16,
      y: 16,
    }),
  });

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const startEdit = (entry: AnnotationEntry) => {
    setEditingId(entry.id);
    setDraftNote(entry.note);
  };

  const saveEdit = (id: string) => {
    if (!draftNote.trim()) return;
    onUpdate(id, { note: draftNote.trim() });
    setEditingId(null);
  };

  return (
    <div
      ref={panelRef}
      className={`pa-session-panel-float ${isDragging ? 'pa-session-panel-float--dragging' : ''}`}
      style={style}
    >
      <GlassPanel variant="sheet" side="right">
      <div className="pa-session-header">
        <div className="pa-session-header-main">
          <button
            type="button"
            className="pa-session-drag"
            aria-label="Drag session panel"
            title="Drag to move"
            {...dragHandleProps}
          >
            <span className="pa-session-grip" aria-hidden="true">
              <span /><span /><span /><span /><span /><span />
            </span>
          </button>
          <h3 className="pa-session-title">Session ({annotations.length})</h3>
        </div>
        <p className="pa-session-subtitle">Persists until tab close</p>
        <div className="pa-session-actions">
          <CopyFeedbackSlot
            feedback={copyAllFrom === 'session' ? copyStatus : null}
            slotClassName="pa-copy-feedback-slot--session"
          >
            <GlassButton
              variant="glass-primary"
              className="pa-glass-btn--sm"
              onClick={onCopyAll}
              disabled={annotations.length === 0}
            >
              Copy all
            </GlassButton>
          </CopyFeedbackSlot>
          <GlassButton variant="ghost" onClick={onClose} aria-label="Close session panel">
            ✕
          </GlassButton>
        </div>
      </div>

      <ul className="pa-session-list">
        {annotations.length === 0 && (
          <li className="pa-session-empty">
            No annotations yet. Click an element, drag an area, or Shift+click for multi-select.
          </li>
        )}
        {annotations.map((entry) => {
          const display = getAnnotationSessionDisplay(entry);
          return (
          <li
            key={entry.id}
            className={
              activeId === entry.id
                ? 'pa-session-item pa-session-item--active'
                : 'pa-session-item'
            }
            onMouseEnter={() => onActiveChange(entry.id)}
            onMouseLeave={() => onActiveChange(null)}
          >
            {editingId === entry.id ? (
              <div className="pa-session-edit">
                <label className="pa-label">
                  Note
                  <textarea
                    className="pa-textarea"
                    value={draftNote}
                    onChange={(e) => setDraftNote(e.target.value)}
                    rows={3}
                  />
                </label>
                <div className="pa-session-item-actions">
                  <GlassButton variant="ghost" onClick={() => setEditingId(null)}>
                    Cancel
                  </GlassButton>
                  <GlassButton
                    variant="glass-primary"
                    onClick={() => saveEdit(entry.id)}
                    disabled={!draftNote.trim()}
                  >
                    Save
                  </GlassButton>
                </div>
              </div>
            ) : (
              <>
                <div className="pa-session-content">
                  <span className="pa-session-target">{display.target}</span>
                  <p className="pa-session-note">{display.note}</p>
                  {display.meta && (
                    <p className="pa-session-meta-line">{display.meta}</p>
                  )}
                </div>
                <div className="pa-session-item-actions">
                  {copyStatus === 'Copied!' && copiedEntryId === entry.id ? (
                    <span
                      className="pa-status pa-copy-feedback-slot pa-copy-feedback-slot--item"
                      role="status"
                      aria-live="polite"
                    >
                      Copied!
                    </span>
                  ) : (
                    <GlassButton
                      variant="glass-primary"
                      className="pa-glass-btn--sm"
                      onClick={() => onCopyOne(entry.id)}
                      aria-label="Copy annotation"
                    >
                      Copy
                    </GlassButton>
                  )}
                  <GlassButton
                    variant="ghost"
                    className="pa-glass-btn--sm pa-session-action-icon"
                    onClick={() => startEdit(entry)}
                    aria-label="Edit annotation note"
                  >
                    ✎
                  </GlassButton>
                  <GlassButton
                    variant="ghost"
                    className="pa-glass-btn--sm pa-session-action-icon"
                    onClick={() => onRemove(entry.id)}
                    aria-label="Remove annotation"
                  >
                    <TrashIcon />
                  </GlassButton>
                </div>
              </>
            )}
          </li>
          );
        })}
      </ul>
      </GlassPanel>
    </div>
  );
}
