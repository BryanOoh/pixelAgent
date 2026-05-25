/**
 * Generates a displacement map PNG (data URI) for the Liquid Glass refraction.
 *
 * Each pixel's R/G channels encode a 2D vector telling `feDisplacementMap` how
 * far to pull the underlying backdrop. The vector field comes from a rounded
 * rect SDF: ~0 in the center (no displacement), increasing toward the rim, so
 * content gets "lens-compressed" at the edges like a real glass element.
 *
 * Same math as shuding/liquid-glass — adapted for variable element sizes and
 * shapes (capsule vs. rect).
 */

export interface DisplacementMap {
  href: string;
  scale: number;
  width: number;
  height: number;
}

/** Rim pull strength — higher = more visible light refraction at edges. */
export const REFRACTION_GAIN_DEFAULT = 0.35;
export const REFRACTION_GAIN_ENHANCED = 0.48;

export function generateLiquidGlassMap(
  width: number,
  height: number,
  borderRadiusPx: number,
  refractionGain: number = REFRACTION_GAIN_DEFAULT
): DisplacementMap | null {
  if (width < 8 || height < 8) return null;

  const dpi = 1;
  const w = Math.max(1, Math.round(width * dpi));
  const h = Math.max(1, Math.round(height * dpi));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const imageData = ctx.createImageData(w, h);
  const data = imageData.data;

  // Normalized corner radius (capped to half the shortest side)
  const r = Math.min(0.5, borderRadiusPx / Math.min(width, height));
  // Half-extents in normalized [-0.5, 0.5] space.
  // 0.3, 0.2 with radius 0.6 = same proportions as shuding's reference;
  // produces a strong "pull toward center" at the rim.
  const hx = 0.3;
  const hy = 0.2;
  const sdfRadius = Math.max(0.4, r + 0.1);

  let maxScale = 0;
  const raw = new Float32Array(w * h * 2);

  let ri = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ux = x / w - 0.5;
      const uy = y / h - 0.5;
      const sdf = roundedRectSDF(ux, uy, hx, hy, sdfRadius);
      const d = smoothStep(0.8, 0, sdf - 0.15);
      const scaled = smoothStep(0, 1, d);
      const dx = (ux * scaled + 0.5) * w - x;
      const dy = (uy * scaled + 0.5) * h - y;
      if (Math.abs(dx) > maxScale) maxScale = Math.abs(dx);
      if (Math.abs(dy) > maxScale) maxScale = Math.abs(dy);
      raw[ri++] = dx;
      raw[ri++] = dy;
    }
  }

  if (maxScale === 0) return null;
  maxScale *= 0.4 * refractionGain;

  let pi = 0;
  for (let i = 0; i < data.length; i += 4) {
    const rEnc = raw[pi++] / maxScale + 0.5;
    const gEnc = raw[pi++] / maxScale + 0.5;
    data[i] = rEnc * 255;
    data[i + 1] = gEnc * 255;
    data[i + 2] = 0;
    data[i + 3] = 255;
  }

  ctx.putImageData(imageData, 0, 0);

  return {
    href: canvas.toDataURL('image/png'),
    scale: maxScale / dpi,
    width: w,
    height: h,
  };
}

function roundedRectSDF(
  x: number,
  y: number,
  hw: number,
  hh: number,
  r: number
): number {
  const qx = Math.abs(x) - hw + r;
  const qy = Math.abs(y) - hh + r;
  return (
    Math.min(Math.max(qx, qy), 0) +
    Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) -
    r
  );
}

function smoothStep(a: number, b: number, t: number): number {
  const x = Math.max(0, Math.min(1, (t - a) / (b - a)));
  return x * x * (3 - 2 * x);
}
