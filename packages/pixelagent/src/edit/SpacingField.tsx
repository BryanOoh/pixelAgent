import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { parsePx } from './propertyControls';
import { clamp, useScrub } from './useScrub';

interface SpacingFieldProps {
  property: 'margin' | 'padding';
  label: string;
  value: string;
  onChange: (value: string) => void;
}

interface Sides {
  top: string;
  right: string;
  bottom: string;
  left: string;
}

function parseShorthand(value: string): Sides {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  const a = parts[0] ?? '0px';
  if (parts.length <= 1) return { top: a, right: a, bottom: a, left: a };
  const b = parts[1];
  if (parts.length === 2) return { top: a, right: b, bottom: a, left: b };
  const c = parts[2];
  if (parts.length === 3) return { top: a, right: b, bottom: c, left: b };
  return { top: a, right: b, bottom: c, left: parts[3] };
}

function formatShorthand({ top, right, bottom, left }: Sides): string {
  if (top === right && right === bottom && bottom === left) return top;
  if (top === bottom && right === left) return `${top} ${right}`;
  if (right === left) return `${top} ${right} ${bottom}`;
  return `${top} ${right} ${bottom} ${left}`;
}

/** Strip "px" suffix from a numeric px value for display in compact inputs. */
function displayNum(value: string): string {
  const m = value.trim().match(/^(-?\d+(?:\.\d+)?)px$/i);
  return m ? m[1] : value;
}

/** Re-suffix when user types a bare number. Leave other values (auto, 0, %, calc()) untouched. */
function normalizeWrite(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed === '') return '0px';
  if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) return `${trimmed}px`;
  return trimmed;
}

/** Pair display: single value if equal, comma-joined when mixed. */
function formatPairDisplay(a: string, b: string): string {
  if (a === b) return displayNum(a);
  return `${displayNum(a)}, ${displayNum(b)}`;
}

/**
 * Parse a pair-cell commit. Accepts either:
 *  - single value → both sides get it
 *  - "a, b" (comma-separated) → first→primary, second→secondary
 * Returns [primary, secondary] as normalized CSS values.
 */
function parsePairCommit(raw: string, fallback: string): [string, string] {
  const parts = raw
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return [fallback, fallback];
  if (parts.length === 1) {
    const v = normalizeWrite(parts[0]);
    return [v, v];
  }
  return [normalizeWrite(parts[0]), normalizeWrite(parts[1])];
}

// ── Icons ─────────────────────────────────────────────────────────────────

const ICON_SIZE = 12;
const ICON_PROPS = {
  width: ICON_SIZE,
  height: ICON_SIZE,
  viewBox: '0 0 12 12',
  fill: 'none',
  'aria-hidden': true,
} as const;

function IconHorizontalPair() {
  return (
    <svg {...ICON_PROPS}>
      <rect x="1.5" y="1.5" width="9" height="9" stroke="currentColor" strokeOpacity="0.35" />
      <line x1="1.5" y1="1.5" x2="1.5" y2="10.5" stroke="currentColor" strokeWidth="1.5" />
      <line x1="10.5" y1="1.5" x2="10.5" y2="10.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function IconVerticalPair() {
  return (
    <svg {...ICON_PROPS}>
      <rect x="1.5" y="1.5" width="9" height="9" stroke="currentColor" strokeOpacity="0.35" />
      <line x1="1.5" y1="1.5" x2="10.5" y2="1.5" stroke="currentColor" strokeWidth="1.5" />
      <line x1="1.5" y1="10.5" x2="10.5" y2="10.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function IconSide({ side }: { side: keyof Sides }) {
  const edges = {
    top: { x1: 1.5, y1: 1.5, x2: 10.5, y2: 1.5 },
    right: { x1: 10.5, y1: 1.5, x2: 10.5, y2: 10.5 },
    bottom: { x1: 1.5, y1: 10.5, x2: 10.5, y2: 10.5 },
    left: { x1: 1.5, y1: 1.5, x2: 1.5, y2: 10.5 },
  }[side];
  return (
    <svg {...ICON_PROPS}>
      <rect x="1.5" y="1.5" width="9" height="9" stroke="currentColor" strokeOpacity="0.35" />
      <line {...edges} stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function IconExpand() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <rect x="2" y="2" width="4" height="4" stroke="currentColor" strokeWidth="1.2" />
      <rect x="8" y="2" width="4" height="4" stroke="currentColor" strokeWidth="1.2" />
      <rect x="2" y="8" width="4" height="4" stroke="currentColor" strokeWidth="1.2" />
      <rect x="8" y="8" width="4" height="4" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

// ── Cell ──────────────────────────────────────────────────────────────────

interface CellProps {
  icon: ReactNode;
  /** Pre-formatted display string (already px-stripped, optionally comma-joined). */
  display: string;
  ariaLabel: string;
  mixed?: boolean;
  /** Called on blur/Enter with the raw draft string. Caller normalizes. */
  onCommit: (raw: string) => void;
  /** Current px value when the cell is a single number — enables drag/arrow scrub. */
  scrubValue: number | null;
  /** Lower bound for scrub (margin allows negatives, padding does not). */
  scrubMin: number;
  /** Called with the new integer px value during a scrub. */
  onScrub: (next: number) => void;
}

function Cell({
  icon,
  display,
  ariaLabel,
  mixed,
  onCommit,
  scrubValue,
  scrubMin,
  onScrub,
}: CellProps) {
  const [draft, setDraft] = useState(display);

  // Sync external value into draft (no focus tracking yet — accept the flicker
  // for now; rare to type and have the same field externally mutate).
  useEffect(() => {
    setDraft(display);
  }, [display]);

  const scrub = useScrub({
    getValue: () => scrubValue,
    min: scrubMin,
    step: 1,
    onChange: onScrub,
  });
  const canScrub = scrubValue !== null;

  return (
    <label className={`pa-spacing-cell ${mixed ? 'pa-spacing-cell--mixed' : ''}`}>
      <span
        className={`pa-spacing-cell-icon${canScrub ? ' pa-spacing-cell-icon--scrub' : ''}${
          scrub.scrubbing ? ' pa-spacing-cell-icon--active' : ''
        }`}
        title={canScrub ? 'Drag to adjust' : undefined}
        {...(canScrub ? scrub.handleProps : {})}
      >
        {icon}
      </span>
      <input
        className="pa-input pa-spacing-cell-input"
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => onCommit(draft)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          else if (e.key === 'Escape') {
            setDraft(display);
            (e.target as HTMLInputElement).blur();
          } else if (
            canScrub &&
            (e.key === 'ArrowUp' || e.key === 'ArrowDown')
          ) {
            e.preventDefault();
            const dir = e.key === 'ArrowUp' ? 1 : -1;
            onScrub(clamp(scrubValue + dir, scrubMin, Infinity));
          }
        }}
        aria-label={ariaLabel}
        spellCheck={false}
      />
    </label>
  );
}

// ── Field ─────────────────────────────────────────────────────────────────

export function SpacingField({ property, label, value, onChange }: SpacingFieldProps) {
  const sides = parseShorthand(value);
  // Pure user intent — pair view can show mixed values via comma notation,
  // so we never force-split based on data anymore.
  const [showSplit, setShowSplit] = useState(false);

  const writeSides = (next: Partial<Sides>) => {
    onChange(formatShorthand({ ...sides, ...next }));
  };

  const horizontalMixed = sides.left !== sides.right;
  const verticalMixed = sides.top !== sides.bottom;

  // Margins may go negative; padding cannot.
  const scrubMin = property === 'margin' ? -Infinity : 0;
  // A pair cell only scrubs when both sides share a single px value.
  const pairScrubValue = (a: string, b: string) =>
    a === b ? parsePx(a) : null;

  return (
    <div className="pa-prop-row pa-prop-row--compact pa-spacing-row">
      <span className="pa-edit-field-label">{label}</span>
      <div
        className={`pa-spacing-control ${
          showSplit ? 'pa-spacing-control--split' : 'pa-spacing-control--pair'
        }`}
      >
        {showSplit ? (
          // Grid mirrors pair-view columns:
          //   Col 1 (horizontal pair) → L on top, R on bottom
          //   Col 2 (vertical pair)   → T on top, B on bottom
          <div className="pa-spacing-grid">
            <Cell
              icon={<IconSide side="left" />}
              display={displayNum(sides.left)}
              ariaLabel={`${label} left`}
              onCommit={(raw) => writeSides({ left: normalizeWrite(raw) })}
              scrubValue={parsePx(sides.left)}
              scrubMin={scrubMin}
              onScrub={(n) => writeSides({ left: `${n}px` })}
            />
            <Cell
              icon={<IconSide side="top" />}
              display={displayNum(sides.top)}
              ariaLabel={`${label} top`}
              onCommit={(raw) => writeSides({ top: normalizeWrite(raw) })}
              scrubValue={parsePx(sides.top)}
              scrubMin={scrubMin}
              onScrub={(n) => writeSides({ top: `${n}px` })}
            />
            <Cell
              icon={<IconSide side="right" />}
              display={displayNum(sides.right)}
              ariaLabel={`${label} right`}
              onCommit={(raw) => writeSides({ right: normalizeWrite(raw) })}
              scrubValue={parsePx(sides.right)}
              scrubMin={scrubMin}
              onScrub={(n) => writeSides({ right: `${n}px` })}
            />
            <Cell
              icon={<IconSide side="bottom" />}
              display={displayNum(sides.bottom)}
              ariaLabel={`${label} bottom`}
              onCommit={(raw) => writeSides({ bottom: normalizeWrite(raw) })}
              scrubValue={parsePx(sides.bottom)}
              scrubMin={scrubMin}
              onScrub={(n) => writeSides({ bottom: `${n}px` })}
            />
          </div>
        ) : (
          <div className="pa-spacing-pair">
            <Cell
              icon={<IconHorizontalPair />}
              display={formatPairDisplay(sides.left, sides.right)}
              mixed={horizontalMixed}
              ariaLabel={`${label} horizontal`}
              onCommit={(raw) => {
                const [left, right] = parsePairCommit(raw, sides.left);
                writeSides({ left, right });
              }}
              scrubValue={pairScrubValue(sides.left, sides.right)}
              scrubMin={scrubMin}
              onScrub={(n) => writeSides({ left: `${n}px`, right: `${n}px` })}
            />
            <Cell
              icon={<IconVerticalPair />}
              display={formatPairDisplay(sides.top, sides.bottom)}
              mixed={verticalMixed}
              ariaLabel={`${label} vertical`}
              onCommit={(raw) => {
                const [top, bottom] = parsePairCommit(raw, sides.top);
                writeSides({ top, bottom });
              }}
              scrubValue={pairScrubValue(sides.top, sides.bottom)}
              scrubMin={scrubMin}
              onScrub={(n) => writeSides({ top: `${n}px`, bottom: `${n}px` })}
            />
          </div>
        )}
        <button
          type="button"
          className={`pa-spacing-toggle ${showSplit ? 'pa-spacing-toggle--on' : ''}`}
          onClick={() => setShowSplit((s) => !s)}
          aria-pressed={showSplit}
          aria-label={showSplit ? 'Collapse to pair view' : 'Expand to per-side view'}
          title={showSplit ? 'Collapse to pair view' : 'Expand to per-side view'}
        >
          <IconExpand />
        </button>
      </div>
    </div>
  );
}
