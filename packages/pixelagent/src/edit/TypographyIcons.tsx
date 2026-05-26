interface IconProps {
  className?: string;
}

export function IconAlignLeft({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M2 3h10v1.5H2V3zm0 3.5h7v1.5H2V6.5zm0 3.5h10v1.5H2V10zm0 3.5h7v1.5H2V13.5z"
      />
    </svg>
  );
}

export function IconAlignCenter({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M3 3h10v1.5H3V3zm1.5 3.5h7v1.5h-7V6.5zm-1.5 3.5h10v1.5H3V10zm1.5 3.5h7v1.5h-7V13.5z"
      />
    </svg>
  );
}

export function IconAlignRight({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M4 3h10v1.5H4V3zm3 3.5h7v1.5H7V6.5zm-3 3.5h10v1.5H4V10zm3 3.5h7v1.5H7V13.5z"
      />
    </svg>
  );
}

export function IconAlignJustify({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path fill="currentColor" d="M2 3h12v1.5H2V3zm0 3.5h12v1.5H2V6.5zm0 3.5h12v1.5H2V10zm0 3.5h12v1.5H2V13.5z" />
    </svg>
  );
}

export function IconStrikethrough({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M11.2 9.25H4.8c.35 1.05 1.2 1.75 2.45 1.75 1.05 0 1.85-.45 2.2-1.15l1.35.55C10.15 11.85 8.7 12.5 7.25 12.5 4.85 12.5 3 10.85 3 8.5h1.5c0 1.55 1.15 2.75 2.75 2.75.55 0 1.05-.15 1.45-.4L3 7.5h10l-1.8 1.75z"
      />
    </svg>
  );
}
