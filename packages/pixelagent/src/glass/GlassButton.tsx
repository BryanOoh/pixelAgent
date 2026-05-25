import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type GlassButtonVariant = 'regular' | 'ghost' | 'glass-primary' | 'icon';

interface GlassButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: GlassButtonVariant;
  children: ReactNode;
}

export function GlassButton({
  variant = 'regular',
  className = '',
  children,
  ...props
}: GlassButtonProps) {
  return (
    <button
      type="button"
      className={`pa-glass-btn pa-glass-btn--${variant} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
}
