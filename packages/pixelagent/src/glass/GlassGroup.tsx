import type { ReactNode } from 'react';
import { GlassSurface, type GlassTint } from './GlassSurface';

interface GlassGroupProps {
  tint?: GlassTint;
  className?: string;
  children: ReactNode;
}

/** Merged glass capsule for a toolbar section (glassEffectUnion equivalent) */
export function GlassGroup({ tint = 'neutral', className = '', children }: GlassGroupProps) {
  return (
    <GlassSurface shape="capsule" tint={tint} className={`pa-glass-group ${className}`.trim()}>
      <div className="pa-glass-group-inner">{children}</div>
    </GlassSurface>
  );
}
