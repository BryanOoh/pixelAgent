import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { matchColorPreset, type ColorPreset } from './colorPresets.js';

interface ColorTokenPopoverProps {
  presets: ColorPreset[];
  value: string;
  onApply: (color: string) => void;
  /** Popover heading + aria label, e.g. "Text color", "Fill color". */
  title?: string;
}

const POPOVER_WIDTH = 300;
const POPOVER_EST_HEIGHT = 360;

function getPickerPortalRootAttributes(): Record<string, string> {
  if (typeof document === 'undefined') return {};
  const root =
    document.querySelector('[data-pixelagent-root]') ??
    document.querySelector('[data-pixelagent-toolbar-portal]');
  const chrome = root?.getAttribute('data-pa-chrome');
  return chrome ? { 'data-pa-chrome': chrome } : {};
}

function IconSearch({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <circle cx="7" cy="7" r="4.5" />
      <line x1="10.5" y1="10.5" x2="14" y2="14" strokeLinecap="round" />
    </svg>
  );
}

function IconSwatches({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <circle cx="6.4" cy="6.4" r="3.4" />
      <circle cx="9.8" cy="9.8" r="3.4" />
    </svg>
  );
}

export function ColorTokenPopover({ presets, value, onApply, title = 'Color' }: ColorTokenPopoverProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const dialogId = useId();
  const [pos, setPos] = useState({ top: 0, left: 0, width: POPOVER_WIDTH });

  const active = useMemo(() => matchColorPreset(presets, value), [presets, value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return presets;
    return presets.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q) ||
        p.value.toLowerCase().includes(q)
    );
  }, [presets, query]);

  const reposition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const width = POPOVER_WIDTH;
    let left = rect.right - width;
    if (left + width > window.innerWidth - 12) left = window.innerWidth - width - 12;
    left = Math.max(12, left);

    let top = rect.bottom + 8;
    if (top + POPOVER_EST_HEIGHT > window.innerHeight - 12) {
      top = Math.max(12, rect.top - POPOVER_EST_HEIGHT - 8);
    }
    setPos({ top, left, width });
  }, []);

  useEffect(() => {
    if (!open) return;
    reposition();
    searchRef.current?.focus();

    const onDocPointer = (e: MouseEvent) => {
      const t = e.target;
      if (triggerRef.current?.contains(t as Node) || popoverRef.current?.contains(t as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };

    window.addEventListener('mousedown', onDocPointer, true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      window.removeEventListener('mousedown', onDocPointer, true);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [open, reposition]);

  if (presets.length === 0) return null;

  const popover = open
    ? createPortal(
        <div
          className="pa-root pa-root--toolbar-portal pa-text-styles-portal"
          data-pixelagent-picker-portal
          {...getPickerPortalRootAttributes()}
        >
          <div
            ref={popoverRef}
            id={dialogId}
            role="dialog"
            aria-label={title}
            className="pa-text-styles"
            style={{ top: pos.top, left: pos.left, width: pos.width }}
          >
            <header className="pa-text-styles-header">
              <span className="pa-text-styles-title">{title}</span>
              <button
                type="button"
                className="pa-text-styles-close"
                aria-label={`Close ${title.toLowerCase()}`}
                onClick={() => setOpen(false)}
              >
                ×
              </button>
            </header>

            <div className="pa-text-styles-search">
              <IconSearch className="pa-text-styles-search-icon" />
              <input
                ref={searchRef}
                type="text"
                className="pa-input pa-text-styles-search-input"
                placeholder="Search"
                value={query}
                spellCheck={false}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            <div className="pa-text-styles-list" role="listbox" aria-label="Color tokens">
              {filtered.length === 0 ? (
                <p className="pa-text-styles-empty">No matching colors</p>
              ) : (
                filtered.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    role="option"
                    aria-selected={active?.id === preset.id}
                    className={`pa-text-styles-row ${active?.id === preset.id ? 'pa-text-styles-row--active' : ''}`}
                    onClick={() => {
                      onApply(preset.value);
                      setOpen(false);
                    }}
                  >
                    <span
                      className="pa-color-presets-swatch"
                      style={{ backgroundColor: preset.value }}
                      aria-hidden="true"
                    />
                    <span className="pa-text-styles-row-label" title={preset.name}>{preset.name}</span>
                    <span className="pa-text-styles-row-metrics">{preset.value}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="pa-edit-section-action"
        aria-label={`${title} tokens`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? dialogId : undefined}
        title="Color tokens"
        onClick={(e) => {
          e.stopPropagation();
          if (!open) reposition();
          setOpen((v) => !v);
        }}
      >
        <IconSwatches className="pa-edit-section-action-icon" />
      </button>
      {popover}
    </>
  );
}
