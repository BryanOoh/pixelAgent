interface IconProps {
  className?: string;
}

export function IconUndo({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.25 8a4.75 4.75 0 0 1 8.1-2.35"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5.1 5.35 3.25 7.2 5.1 9.05"
      />
    </svg>
  );
}

export function IconReset({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M11.1 3.65a4.75 4.75 0 0 1 1.15 7.75M12.05 11.35v2.15h-2.15"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4.9 12.35a4.75 4.75 0 0 1-1.15-7.75M3.95 4.65V2.5h2.15"
      />
    </svg>
  );
}
