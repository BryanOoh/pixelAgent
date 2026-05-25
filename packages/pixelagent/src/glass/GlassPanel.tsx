import type { CSSProperties, ReactNode } from 'react';
import { GlassSurface } from './GlassSurface';

export type GlassPanelVariant = 'sheet' | 'popover';
export type GlassPanelSide = 'left' | 'right' | 'bottom';

interface GlassPanelProps {
  variant?: GlassPanelVariant;
  side?: GlassPanelSide;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

export function GlassPanel({
  variant = 'sheet',
  side = 'left',
  className = '',
  style,
  children,
}: GlassPanelProps) {
  const radius = variant === 'popover' ? 16 : 20;

  return (
    <GlassSurface
      shape="rect"
      cornerRadius={radius}
      className={`pa-glass-panel pa-glass-panel--${variant} pa-glass-panel--${side} ${className}`.trim()}
      style={style}
    >
      {children}
    </GlassSurface>
  );
}
