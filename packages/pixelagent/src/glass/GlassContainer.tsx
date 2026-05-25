import type { CSSProperties, ReactNode } from 'react';

interface GlassContainerProps {
  className?: string;
  style?: CSSProperties;
  role?: string;
  'aria-label'?: string;
  children: ReactNode;
}

/** GlassEffectContainer — groups glass capsules with spacing for morph proximity */
export function GlassContainer({
  className = '',
  style,
  role,
  'aria-label': ariaLabel,
  children,
}: GlassContainerProps) {
  return (
    <div
      className={`pa-glass-container ${className}`.trim()}
      style={style}
      role={role}
      aria-label={ariaLabel}
    >
      {children}
    </div>
  );
}
