import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { IconTextStyles } from './TypographyIcons';
import {
  formatPresetMetrics,
  matchPreset,
  type TypographyPreset,
} from './typographyPresets.js';

interface TextStylesPopoverProps {
  presets: TypographyPreset[];
  fontSize: string;
  lineHeight: string;
  onApply: (preset: TypographyPreset) => void;
}

const POPOVER_WIDTH = 264;
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
    <svg
      className={className}
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <circle cx="7" cy="7" r="4.5" />
      <line x1="10.5" y1="10.5" x2="14" y2="14" strokeLinecap="round" />
    </svg>
  );
}

export function TextStylesPopover({
  presets,
  fontSize,
  lineHeight,
  onApply,
}: TextStylesPopoverProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const dialogId = useId();
  const [pos, setPos] = useState({ top: 0, left: 0, width: POPOVER_WIDTH });

  const active = useMemo(
    () => matchPreset(presets, fontSize, lineHeight),
    [presets, fontSize, lineHeight]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return presets;
    return presets.filter((p) => p.label.toLowerCase().includes(q) || p.id.toLowerCase().includes(q));
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
            aria-label="Text styles"
            className="pa-text-styles"
            style={{ top: pos.top, left: pos.left, width: pos.width }}
          >
            <header className="pa-text-styles-header">
              <span className="pa-text-styles-title">Text styles</span>
              <button
                type="button"
                className="pa-text-styles-close"
                aria-label="Close text styles"
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

            <div className="pa-text-styles-list" role="listbox" aria-label="Text styles">
              {filtered.length === 0 ? (
                <p className="pa-text-styles-empty">No matching styles</p>
              ) : (
                filtered.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    role="option"
                    aria-selected={active?.id === preset.id}
                    className={`pa-text-styles-row ${active?.id === preset.id ? 'pa-text-styles-row--active' : ''}`}
                    onClick={() => {
                      onApply(preset);
                      setOpen(false);
                    }}
                  >
                    <span className="pa-text-styles-specimen" aria-hidden="true">
                      Ag
                    </span>
                    <span className="pa-text-styles-row-label">{preset.label}</span>
                    <span className="pa-text-styles-row-metrics">· {formatPresetMetrics(preset)}</span>
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
        aria-label="Text styles"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? dialogId : undefined}
        title="Text styles"
        onClick={(e) => {
          // Stop the click from toggling the section accordion.
          e.stopPropagation();
          if (!open) reposition();
          setOpen((v) => !v);
        }}
      >
        <IconTextStyles className="pa-edit-section-action-icon" />
      </button>
      {popover}
    </>
  );
}
