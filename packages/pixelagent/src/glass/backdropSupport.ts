/**
 * Safari and Firefox do not apply SVG filters (especially feDisplacementMap) via
 * backdrop-filter: url(#id). The entire declaration is dropped — including blur().
 * Chromium (Cursor preview, Chrome) supports the full chain.
 *
 * @see https://bugs.webkit.org/show_bug.cgi?id=245510
 */
export function supportsBackdropSvgRefraction(): boolean {
  if (typeof navigator === 'undefined') return false;

  const ua = navigator.userAgent;

  // Safari (WebKit without Chromium engine)
  if (/AppleWebKit/i.test(ua) && !/Chrome|Chromium|Edg|OPR|CriOS|FxiOS/i.test(ua)) {
    return false;
  }

  // Firefox drops unsupported SVG primitives from the backdrop-filter chain
  if (/Firefox/i.test(ua)) return false;

  return true;
}

export type GlassBackdropIntensity = 'default' | 'enhanced';

const FROST_BACKDROP: Record<GlassBackdropIntensity, string> = {
  default: 'blur(4px) saturate(130%)',
  /** Toolbar — slightly stronger frost + refraction chain. */
  enhanced: 'blur(6px) saturate(138%)',
};

/** Pixel literals — keep in sync with --pa-glass-blur / --pa-glass-saturate in tokens.css */
export const FROST_BACKDROP_DEFAULT = FROST_BACKDROP.default;

export function frostBackdropStyle(
  filterId: string | null,
  intensity: GlassBackdropIntensity = 'default'
): {
  backdropFilter: string;
  WebkitBackdropFilter: string;
} {
  const frost = FROST_BACKDROP[intensity];
  const useRefraction = filterId !== null && supportsBackdropSvgRefraction();
  const value = useRefraction ? `${frost} url(#${filterId})` : frost;
  return {
    backdropFilter: value,
    WebkitBackdropFilter: value,
  };
}
