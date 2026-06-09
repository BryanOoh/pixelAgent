import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CSSProperties, ReactNode } from 'react';
import { generateLiquidGlassMap, type DisplacementMap } from './displacementMap';
import {
  frostBackdropStyle,
  supportsBackdropSvgRefraction,
  type GlassBackdropIntensity,
} from './backdropSupport';
import { REFRACTION_GAIN_DEFAULT, REFRACTION_GAIN_ENHANCED } from './displacementMap';

export type GlassShape = 'capsule' | 'rect';
export type GlassTint = 'neutral' | 'accent';

interface GlassSurfaceProps {
  shape?: GlassShape;
  cornerRadius?: number;
  tint?: GlassTint;
  /** `enhanced` = stronger blur + rim refraction (toolbar). */
  intensity?: GlassBackdropIntensity;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

let filterCounter = 0;

export function GlassSurface({
  shape = 'rect',
  cornerRadius,
  tint = 'neutral',
  intensity = 'default',
  className = '',
  style,
  children,
}: GlassSurfaceProps) {
  const radius = cornerRadius ?? (shape === 'capsule' ? 9999 : 20);
  const refractionGain =
    intensity === 'enhanced' ? REFRACTION_GAIN_ENHANCED : REFRACTION_GAIN_DEFAULT;
  const surfaceRef = useRef<HTMLDivElement>(null);
  const webglCanvasRef = useRef<HTMLCanvasElement>(null);
  const isDraggingRef = useRef(false);
  const filterId = useMemo(() => `pa-lg-${++filterCounter}`, []);
  const [map, setMap] = useState<DisplacementMap | null>(null);

  // Decide the rendering path ON THE CLIENT only — `supportsBackdropSvgRefraction`
  // returns false during SSR (no navigator), which would mismatch hydration if
  // we keyed the JSX off of it directly. Starting at `null` makes both server
  // and first client render produce the same DOM; the effect flips it to the
  // real value on mount, triggering a re-render with the correct branch.
  const [usesWebglFallback, setUsesWebglFallback] = useState<boolean | null>(null);
  useEffect(() => {
    const needsFallback = !supportsBackdropSvgRefraction();
    setUsesWebglFallback(needsFallback);
    // Eager warm-up: kick off the lazy chunks the moment we know we'll need
    // them, instead of waiting for the displacement map + RAF tick + capture
    // to finish in series. The network fetch overlaps the synchronous setup,
    // shaving the visible "no refraction → refraction" delay by 50–200 ms.
    if (needsFallback) {
      void import('./captureBehind');
      void import('./glassDisplacementWebGL');
    }
  }, []);

  // Tick that invalidates the cached refraction render on scroll/resize.
  const [refractionTick, setRefractionTick] = useState(0);

  useLayoutEffect(() => {
    const el = surfaceRef.current;
    if (!el) return;

    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const rect = el.getBoundingClientRect();
        const w = Math.round(rect.width);
        const h = Math.round(rect.height);
        if (w < 8 || h < 8) return;
        const effectiveRadius =
          shape === 'capsule' ? h / 2 : Math.min(radius, w / 2, h / 2);
        const result = generateLiquidGlassMap(w, h, effectiveRadius, refractionGain);
        if (result) setMap(result);
      });
    };

    update();
    const observer = new ResizeObserver(() => {
      update();
      // A surface resize invalidates the captured background too.
      setRefractionTick((t) => t + 1);
    });
    observer.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [shape, radius, refractionGain]);

  // WebGL refraction path (Safari/Firefox). Dynamic-imports the heavy
  // dependencies — Chromium users never download these chunks because the
  // useState flag stays false on their first effect run.
  useEffect(() => {
    if (!usesWebglFallback || !map) return;
    const surface = surfaceRef.current;
    const canvas = webglCanvasRef.current;
    if (!surface || !canvas) return;

    let cancelled = false;
    (async () => {
      const [capturer, { renderDisplaced }] = await Promise.all([
        import('./captureBehind'),
        import('./glassDisplacementWebGL'),
      ]);
      if (cancelled) return;
      // Outside a drag, treat each render as authoritative — invalidate the
      // cache so host-page changes (newly-mounted overlays, selection
      // highlights, etc.) are picked up in the next snapshot. Inside a drag
      // we keep the cache to stay at 60 fps; the next non-drag tick refreshes.
      if (!isDraggingRef.current) {
        capturer.invalidateCaptureCache();
      }
      const cap = await capturer.captureBehind({ surface });
      if (cancelled || !cap) return;
      await renderDisplaced({
        background: cap.canvas,
        displacementMap: map,
        width: cap.width,
        height: cap.height,
        canvas,
      });
      if (cancelled) return;
      // First successful frame — fade the canvas in over the backdrop blur
      // so the user never sees an empty/dark rectangle while the pipeline
      // catches up. CSS handles the transition.
      canvas.setAttribute('data-pa-ready', '1');
    })().catch(() => {
      // Capture or shader failure → keep the blur-only look (still better than
      // a flash of empty canvas). Swallowed quietly to avoid noisy consoles on
      // pages with cross-origin assets the snapshot can't access.
    });

    return () => {
      cancelled = true;
    };
  }, [usesWebglFallback, map, refractionTick]);

  // Re-render the refraction whenever the page content underneath might have
  // shifted. Scroll just changes the crop region (the cached host snapshot
  // stays valid), drag moves the surface (same), so both trigger a tick. The
  // captureBehind cache absorbs the cost — only the first call ever runs
  // modern-screenshot; subsequent calls re-crop the cached canvas in ~1 ms.
  // Window resize + theme switch invalidate the cache (page content actually
  // changed), wired below.
  useEffect(() => {
    if (!usesWebglFallback) return;
    const onScroll = () => setRefractionTick((t) => t + 1);
    window.addEventListener('scroll', onScroll, { passive: true, capture: true });
    return () => window.removeEventListener('scroll', onScroll, true);
  }, [usesWebglFallback]);

  // Drag tracking — match Chromium's live `backdrop-filter` behavior by
  // re-cropping the cached snapshot at the surface's new position on every
  // pointer-move during a drag. ~1 ms per frame keeps refraction stuck to
  // the page underneath instead of the panel.
  useEffect(() => {
    if (!usesWebglFallback) return;
    const surface = surfaceRef.current;
    if (!surface) return;

    let down: { x: number; y: number } | null = null;
    let dragging = false;
    let raf = 0;
    const tick = () => {
      raf = 0;
      setRefractionTick((t) => t + 1);
    };
    const scheduleTick = () => {
      if (raf === 0) raf = requestAnimationFrame(tick);
    };

    const onDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY };
    };
    const onMove = (e: PointerEvent) => {
      if (!down) return;
      if (!dragging && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 3) {
        dragging = true;
        isDraggingRef.current = true;
      }
      if (dragging) scheduleTick();
    };
    const onUp = () => {
      if (dragging) {
        dragging = false;
        isDraggingRef.current = false;
        // Final tick so the canvas lands on the exact drop position AND
        // re-captures with whatever DOM changed during the drag.
        scheduleTick();
      }
      down = null;
    };

    surface.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      if (raf !== 0) cancelAnimationFrame(raf);
      surface.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [usesWebglFallback]);

  // Cache invalidation — window resize and theme change actually rearrange
  // the underlying page pixels, so the cached snapshot is no longer valid.
  // Tick triggers a fresh modern-screenshot pass on the next render.
  useEffect(() => {
    if (!usesWebglFallback) return;
    let cancelled = false;
    const invalidate = async () => {
      if (cancelled) return;
      const { invalidateCaptureCache } = await import('./captureBehind');
      if (!cancelled) {
        invalidateCaptureCache();
        setRefractionTick((t) => t + 1);
      }
    };
    const onResize = () => {
      void invalidate();
    };
    window.addEventListener('resize', onResize);
    const themeObserver = new MutationObserver(() => void invalidate());
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'class'],
    });
    return () => {
      cancelled = true;
      window.removeEventListener('resize', onResize);
      themeObserver.disconnect();
    };
  }, [usesWebglFallback]);

  const filterPortal =
    map && usesWebglFallback === false && typeof document !== 'undefined'
      ? createPortal(
          <svg
            aria-hidden
            width="0"
            height="0"
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: 0,
              height: 0,
              overflow: 'hidden',
              pointerEvents: 'none',
            }}
          >
            <defs>
              <filter
                id={filterId}
                filterUnits="userSpaceOnUse"
                colorInterpolationFilters="sRGB"
                x="0"
                y="0"
                width={map.width}
                height={map.height}
              >
                <feImage
                  href={map.href}
                  xlinkHref={map.href}
                  width={map.width}
                  height={map.height}
                  preserveAspectRatio="none"
                  result="map"
                />
                <feDisplacementMap
                  in="SourceGraphic"
                  in2="map"
                  scale={map.scale}
                  xChannelSelector="R"
                  yChannelSelector="G"
                />
              </filter>
            </defs>
          </svg>,
          document.body
        )
      : null;

  return (
    <>
      {filterPortal}
      <div
        ref={surfaceRef}
        className={`pa-glass-surface pa-glass-surface--${shape} pa-glass-surface--${tint} ${className}`.trim()}
        style={{
          borderRadius: shape === 'capsule' ? '999px' : `${radius}px`,
          ...frostBackdropStyle(
            map && usesWebglFallback === false ? filterId : null,
            intensity
          ),
          ...style,
        }}
      >
        {usesWebglFallback ? (
          <canvas
            ref={webglCanvasRef}
            className="pa-glass-surface-refraction"
            aria-hidden="true"
          />
        ) : null}
        <div className="pa-glass-surface-bg" aria-hidden="true" />
        <div className="pa-glass-surface-shine" aria-hidden="true" />
        <div className="pa-glass-surface-content">{children}</div>
      </div>
    </>
  );
}
