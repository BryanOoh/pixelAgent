import { useLayoutEffect, useMemo, useRef, useState } from 'react';
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
  const filterId = useMemo(() => `pa-lg-${++filterCounter}`, []);
  const [map, setMap] = useState<DisplacementMap | null>(null);

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
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [shape, radius, refractionGain]);

  const filterPortal =
    map && supportsBackdropSvgRefraction() && typeof document !== 'undefined'
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
            map && supportsBackdropSvgRefraction() ? filterId : null,
            intensity
          ),
          ...style,
        }}
      >
        <div className="pa-glass-surface-bg" aria-hidden="true" />
        <div className="pa-glass-surface-shine" aria-hidden="true" />
        <div className="pa-glass-surface-content">{children}</div>
      </div>
    </>
  );
}
