/**
 * Snapshot the host DOM region behind a glass surface so the WebGL2
 * displacement shader has pixels to refract.
 *
 * Uses `modern-screenshot` (a focused html2canvas alternative — ~14 KB gz)
 * which walks the target subtree, inlines computed styles into a cloned
 * SVG `<foreignObject>`, and rasterises via `Image` + `<canvas>`. The
 * cloned tree honors the page's actual CSS, fonts, and inline styles,
 * which is what makes the refracted background read as "the real page"
 * instead of a stylesheet-less skeleton.
 *
 * The surface element itself is excluded from the capture so the panel's
 * own glass is not sampled into its background (which would loop visually
 * and amplify refraction artifacts on each scroll-triggered re-capture).
 *
 * For drag parity with Chromium's live `backdrop-filter: url(#…)` chain,
 * the full host snapshot is cached per host element. Drag frames re-crop
 * the cached canvas to the surface's current rect (~1 ms) instead of
 * running modern-screenshot again (~100–500 ms), so refraction tracks
 * the panel position at 60 fps. Callers invalidate the cache when the
 * underlying page changes — scroll, resize, theme toggle.
 */

import { domToCanvas } from 'modern-screenshot';

export interface CaptureBehindInputs {
  /** The glass surface element — excluded from the snapshot. */
  surface: HTMLElement;
  /** Root to capture from. Defaults to document.body. */
  host?: HTMLElement;
  /** Capture scale; <1 trades fidelity for speed. Defaults to devicePixelRatio. */
  scale?: number;
}

export interface CaptureResult {
  /** Cropped canvas matching the surface's visual rect, ready to feed the shader. */
  canvas: HTMLCanvasElement;
  /** Width and height of the cropped canvas in CSS pixels. */
  width: number;
  height: number;
}

interface CachedSnapshot {
  full: HTMLCanvasElement;
  scale: number;
}

const fullSnapshotByHost = new WeakMap<HTMLElement, CachedSnapshot>();
// Track in-flight capture promises so concurrent calls collapse to one snapshot.
const pendingByHost = new WeakMap<HTMLElement, Promise<HTMLCanvasElement | null>>();

/**
 * Drop the cached host snapshot. Call when the underlying page may have
 * changed visually (scroll, resize, theme switch) so the next captureBehind
 * runs a fresh modern-screenshot pass instead of re-cropping stale pixels.
 */
export function invalidateCaptureCache(host: HTMLElement = document.body): void {
  fullSnapshotByHost.delete(host);
  pendingByHost.delete(host);
}

async function captureFullHost(
  host: HTMLElement,
  scale: number,
  excludeSurface: HTMLElement
): Promise<HTMLCanvasElement | null> {
  const cached = fullSnapshotByHost.get(host);
  if (cached && cached.scale === scale) return cached.full;

  let inflight = pendingByHost.get(host);
  if (!inflight) {
    inflight = (async () => {
      try {
        const canvas = await domToCanvas(host, {
          scale,
          backgroundColor: null,
          filter: (node) => {
            if (node === excludeSurface) return false;
            if (node instanceof Element && excludeSurface.contains(node)) return false;
            return true;
          },
        });
        fullSnapshotByHost.set(host, { full: canvas, scale });
        return canvas;
      } catch {
        return null;
      } finally {
        pendingByHost.delete(host);
      }
    })();
    pendingByHost.set(host, inflight);
  }
  return inflight;
}

/**
 * Capture the page region behind the given glass surface and return a canvas
 * cropped to the surface's bounding rect (in CSS pixels). The full host
 * snapshot is cached — subsequent calls re-crop the cache, so calling this
 * once per drag frame is cheap (cropping is ~1 ms). Invalidate the cache
 * with {@link invalidateCaptureCache} when the page itself changes.
 *
 * Returns `null` if the capture fails (cross-origin canvas taint, missing
 * stylesheet, etc.); the caller should fall back to a blur-only look.
 */
export async function captureBehind(
  inputs: CaptureBehindInputs
): Promise<CaptureResult | null> {
  const { surface, host = document.body, scale = window.devicePixelRatio || 1 } = inputs;

  const full = await captureFullHost(host, scale, surface);
  if (!full) return null;

  const rect = surface.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));

  // Crop to the surface's CURRENT visual region — when called repeatedly
  // during a drag this samples a different region of the same cached full
  // canvas each frame, giving Chromium-parity live refraction without
  // re-running the expensive modern-screenshot pass.
  const out = document.createElement('canvas');
  out.width = width;
  out.height = height;
  const ctx = out.getContext('2d');
  if (!ctx) return null;

  // Capture is at `scale`; source coords on `full` are scaled accordingly.
  // Host clientRect coords are page-relative; modern-screenshot rasterises in
  // page-coordinate space, so no scroll offset is needed.
  ctx.drawImage(
    full,
    Math.round(rect.left * scale),
    Math.round(rect.top * scale),
    Math.round(width * scale),
    Math.round(height * scale),
    0,
    0,
    width,
    height
  );

  return { canvas: out, width, height };
}
