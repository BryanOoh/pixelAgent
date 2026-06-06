import { useCallback, useEffect, useId, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { Hsv, Rgb } from './colorModel.js';
import {
  formatHexInput,
  hsvFromCss,
  hsvToRgb,
  parseCssColor,
  parseHexInput,
  rgbToCss,
  rgbToHex,
  rgbToHsv,
} from './colorModel.js';

interface ColorPickerPopoverProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Optional control rendered to the right of the field label (e.g. a token picker). */
  labelAction?: ReactNode;
}

function cssFromHsv(hsv: Hsv): string {
  return rgbToHex(hsvToRgb(hsv));
}

function pointerPercent(clientX: number, clientY: number, rect: DOMRect) {
  const x = clamp01((clientX - rect.left) / rect.width);
  const y = clamp01((clientY - rect.top) / rect.height);
  return { x: x * 100, y: y * 100 };
}

function clamp01(n: number) {
  return Math.min(1, Math.max(0, n));
}

function getPickerPortalRootAttributes(): Record<string, string> {
  if (typeof document === 'undefined') return {};
  const root =
    document.querySelector('[data-pixelagent-root]') ??
    document.querySelector('[data-pixelagent-toolbar-portal]');
  const chrome = root?.getAttribute('data-pa-chrome');
  return chrome ? { 'data-pa-chrome': chrome } : {};
}

export function ColorPickerPopover({ label, value, onChange, labelAction }: ColorPickerPopoverProps) {
  const [open, setOpen] = useState(false);
  const [hsv, setHsv] = useState<Hsv>(() => hsvFromCss(value));
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const sbRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const [pos, setPos] = useState({ top: 0, left: 0, width: 260 });

  const rgb = hsvToRgb(hsv);
  const hex = formatHexInput(rgbToHex(rgb));
  const preview = parseCssColor(value) ? value : rgbToCss(rgb);
  const headerLabel = label.toLowerCase().includes('color') ? label : `${label} color`;

  useEffect(() => {
    setHsv(hsvFromCss(value));
  }, [value]);

  const updateHsv = useCallback(
    (next: Hsv) => {
      setHsv(next);
      onChange(cssFromHsv(next));
    },
    [onChange]
  );

  const updateRgb = useCallback(
    (next: Rgb) => {
      updateHsv(rgbToHsv(next));
    },
    [updateHsv]
  );

  const reposition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const width = 260;
    let left = rect.left;
    if (left + width > window.innerWidth - 12) {
      left = window.innerWidth - width - 12;
    }
    left = Math.max(12, left);

    let top = rect.bottom + 8;
    const estimatedHeight = 320;
    if (top + estimatedHeight > window.innerHeight - 12) {
      top = Math.max(12, rect.top - estimatedHeight - 8);
    }

    setPos({ top, left, width });
  }, []);

  useEffect(() => {
    if (!open) return;
    reposition();

    const onDocPointer = (e: MouseEvent) => {
      const t = e.target;
      if (
        triggerRef.current?.contains(t as Node) ||
        popoverRef.current?.contains(t as Node)
      ) {
        return;
      }
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

  const handleSbPointer = (clientX: number, clientY: number) => {
    const rect = sbRef.current?.getBoundingClientRect();
    if (!rect) return;
    const { x, y } = pointerPercent(clientX, clientY, rect);
    updateHsv({ ...hsv, s: x, v: 100 - y });
  };

  const startSbDrag = (e: ReactMouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    handleSbPointer(e.clientX, e.clientY);

    const onMove = (ev: MouseEvent) => handleSbPointer(ev.clientX, ev.clientY);
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const popover = open
    ? createPortal(
        <div
          className="pa-root pa-root--toolbar-portal pa-color-picker-portal"
          data-pixelagent-picker-portal
          {...getPickerPortalRootAttributes()}
        >
          <div
            ref={popoverRef}
            id={listboxId}
            role="dialog"
            aria-label={headerLabel}
            className="pa-color-picker"
            style={{ top: pos.top, left: pos.left, width: pos.width }}
          >
          <header className="pa-color-picker-header">
            <span
              className="pa-color-picker-preview"
              style={{ backgroundColor: preview }}
              aria-hidden="true"
            />
            <span className="pa-color-picker-header-label">{headerLabel}</span>
          </header>

          <div
            ref={sbRef}
            className="pa-color-picker-sb"
            style={{ ['--pa-picker-h' as string]: String(Math.round(hsv.h)) }}
            onMouseDown={startSbDrag}
          >
            <span
              className="pa-color-picker-sb-thumb"
              style={{ left: `${hsv.s}%`, top: `${100 - hsv.v}%` }}
              aria-hidden="true"
            />
          </div>

          <div className="pa-color-picker-hue">
            <input
              type="range"
              className="pa-color-picker-hue-input"
              min={0}
              max={360}
              value={Math.round(hsv.h)}
              aria-label="Hue"
              onChange={(e) => updateHsv({ ...hsv, h: parseFloat(e.target.value) })}
            />
            <span
              className="pa-color-picker-hue-thumb"
              style={{ left: `${(hsv.h / 360) * 100}%` }}
              aria-hidden="true"
            />
          </div>

          <label className="pa-color-picker-field">
            <span className="pa-color-picker-field-label">Hex</span>
            <input
              className="pa-input pa-color-picker-input"
              type="text"
              value={hex}
              spellCheck={false}
              onChange={(e) => updateRgb(parseHexInput(e.target.value, rgb))}
            />
          </label>

          <div className="pa-color-picker-rgb">
            {(['r', 'g', 'b'] as const).map((channel) => (
              <label key={channel} className="pa-color-picker-field pa-color-picker-field--rgb">
                <span className="pa-color-picker-field-label">{channel.toUpperCase()}</span>
                <input
                  className="pa-input pa-color-picker-input"
                  type="number"
                  min={0}
                  max={255}
                  value={rgb[channel]}
                  onChange={(e) => {
                    const n = clamp01Channel(parseInt(e.target.value, 10));
                    updateRgb({ ...rgb, [channel]: n });
                  }}
                />
              </label>
            ))}
          </div>
        </div>
        </div>,
        document.body
      )
    : null;

  return (
    <div className="pa-color-field">
      {labelAction ? (
        <div className="pa-color-field-label-row">
          <span className="pa-edit-field-label">{label}</span>
          {labelAction}
        </div>
      ) : (
        <span className="pa-edit-field-label">{label}</span>
      )}
      <button
        ref={triggerRef}
        type="button"
        className="pa-color-field-trigger"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={open ? listboxId : undefined}
        onClick={() => {
          if (!open) reposition();
          setOpen((v) => !v);
        }}
      >
        <span className="pa-color-field-swatch" style={{ backgroundColor: preview }} aria-hidden="true" />
        <input
          className="pa-input pa-color-field-hex"
          type="text"
          value={value}
          readOnly
          tabIndex={-1}
          aria-hidden="true"
        />
      </button>
      {popover}
    </div>
  );
}

function clamp01Channel(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.min(255, Math.max(0, n));
}
