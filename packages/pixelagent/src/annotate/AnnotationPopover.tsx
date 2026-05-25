import { useEffect, useRef, useState } from 'react';
import {
  getEditableTextInfo,
  getElementDisplayLabel,
  getWindowSelectionText,
} from '@pixelagent/shared';
import { GlassButton, GlassPanel } from '../glass';
import { useElementRect } from '../hooks/useElementRect';
import { computeAnnotationPopoverPosition } from './popoverPosition';

interface AnnotationPopoverProps {
  elements: Element[];
  areaBbox?: { x: number; y: number; width: number; height: number };
  onSubmit: (note: string, continuous: boolean) => void;
  onCancel: () => void;
}

export function AnnotationPopover({
  elements,
  areaBbox,
  onSubmit,
  onCancel,
}: AnnotationPopoverProps) {
  const [note, setNote] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const primary = elements[0] ?? null;

  const anchorRect = areaBbox
    ? new DOMRect(areaBbox.x, areaBbox.y, areaBbox.width, areaBbox.height)
    : null;
  const elementRect = useElementRect(primary);
  const rect = anchorRect ?? elementRect;

  const selectedText = getWindowSelectionText();
  const textInfo = primary ? getEditableTextInfo(primary) : { kind: 'none' as const, value: '' };
  const elementText = textInfo.kind !== 'none' ? textInfo.value : undefined;

  useEffect(() => {
    inputRef.current?.focus();
  }, [elements]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  if (!rect) return null;

  const pos = computeAnnotationPopoverPosition(rect);
  const selectorLabel =
    elements.length > 1
      ? `${elements.length} selected`
      : primary
        ? getElementDisplayLabel(primary)
        : 'Area selection';

  const handleSubmit = (continuous: boolean) => {
    if (note.trim()) onSubmit(note, continuous);
  };

  return (
    <GlassPanel
      variant="popover"
      style={{ top: pos.top, left: pos.left }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Add annotation"
        className="pa-popover-body"
      >
        <div className="pa-popover-header">
          <span className="pa-popover-selector">{selectorLabel}</span>
        </div>

        {(selectedText || elementText) && (
          <div className="pa-popover-context">
            {selectedText && (
              <p className="pa-popover-context-line">
                <span className="pa-popover-context-label">Selected</span>
                {selectedText}
              </p>
            )}
            {elementText && elementText !== selectedText && (
              <p className="pa-popover-context-line">
                <span className="pa-popover-context-label">Element</span>
                {elementText}
              </p>
            )}
          </div>
        )}

        <label className="pa-label">
          Note
          <textarea
            ref={inputRef}
            className="pa-textarea"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Describe the change..."
            rows={3}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleSubmit(e.shiftKey);
              }
              if (e.key === 'Escape') onCancel();
            }}
          />
        </label>

        <p className="pa-popover-hint">⌘↵ Add · ⇧⌘↵ Add &amp; next · Esc Cancel</p>

        <div className="pa-popover-actions">
          <GlassButton variant="ghost" onClick={onCancel}>
            Cancel
          </GlassButton>
          <GlassButton
            variant="ghost"
            onClick={() => handleSubmit(true)}
            disabled={!note.trim()}
          >
            Add &amp; next
          </GlassButton>
          <GlassButton
            variant="glass-primary"
            onClick={() => handleSubmit(false)}
            disabled={!note.trim()}
          >
            Add
          </GlassButton>
        </div>
      </div>
    </GlassPanel>
  );
}
