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

/**
 * Capture the page region behind the given glass surface and return a canvas
 * cropped to the surface's bounding rect (in CSS pixels). The caller is
 * responsible for triggering re-captures (scroll, resize, theme change) —
 * this function performs a single snapshot.
 *
 * Returns `null` if the capture fails (cross-origin canvas taint, missing
 * stylesheet, etc.); the caller should fall back to a blur-only look.
 */
export async function captureBehind(
  inputs: CaptureBehindInputs
): Promise<CaptureResult | null> {
  const { surface, host = document.body, scale = window.devicePixelRatio || 1 } = inputs;

  const rect = surface.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));

  // Snapshot the host — modern-screenshot inlines styles into a cloned tree,
  // serialises to an SVG <foreignObject>, then rasterises into a canvas. The
  // `filter` excludes the glass surface so it doesn't recurse into itself.
  let full: HTMLCanvasElement;
  try {
    full = await domToCanvas(host, {
      scale,
      backgroundColor: null,
      filter: (node) => {
        if (node === surface) return false;
        if (node instanceof Element && surface.contains(node)) return false;
        return true;
      },
    });
  } catch {
    return null;
  }

  // Crop to the surface's visual region — modern-screenshot returns a
  // host-sized canvas, but the shader only needs the pixels under (and
  // immediately around) the panel.
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
