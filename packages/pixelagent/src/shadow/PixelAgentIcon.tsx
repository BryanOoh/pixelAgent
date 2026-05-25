export type PixelAgentIconVariant = 'cursor' | 'pointer';

interface PixelAgentIconProps {
  /** Render size in CSS pixels (SVG scales via viewBox). */
  size?: number;
  /** `cursor` = minimal geometric pointer (default); `pointer` = classic arrow. */
  variant?: PixelAgentIconVariant;
}

const VIEWBOX = '0 0 24 24';

/** ShiftClick-style mark: square tail + right-triangle head (hotspot top-left). */
function MinimalCursorMark() {
  return (
    <>
      <rect x="3" y="14" width="4" height="4" fill="currentColor" />
      <path fill="currentColor" d="M7 5h12v12L7 5z" />
    </>
  );
}

const CLASSIC_ARROW =
  'M4.5 2.5L4.5 17.25L9.1 12.9L11.35 19.15L13.55 17.95L11.05 11.85L16.85 11.85L4.5 2.5Z';

/** Toolbar brand — minimal cursor SVG, scales with `size`. */
export function PixelAgentIcon({ size = 22, variant = 'cursor' }: PixelAgentIconProps) {
  if (variant === 'pointer') {
    return (
      <svg
        className="pa-brand-cursor pa-brand-cursor--pointer"
        width={size}
        height={size}
        viewBox={VIEWBOX}
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          fill="currentColor"
          d={CLASSIC_ARROW}
        />
      </svg>
    );
  }

  return (
    <svg
      className="pa-brand-cursor pa-brand-cursor--minimal"
      width={size}
      height={size}
      viewBox={VIEWBOX}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <MinimalCursorMark />
    </svg>
  );
}
