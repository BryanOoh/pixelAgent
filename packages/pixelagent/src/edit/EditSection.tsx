import { useState, type ReactNode } from 'react';

interface EditSectionProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  badge?: string;
  /** Optional icon-only control rendered between the title and the chevron. */
  headerAction?: ReactNode;
}

export function EditSection({
  title,
  children,
  defaultOpen = false,
  badge,
  headerAction,
}: EditSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const toggle = () => setOpen((v) => !v);

  return (
    <section className={`pa-edit-section ${open ? 'pa-edit-section--open' : ''}`}>
      <div className="pa-edit-section-header">
        <button
          type="button"
          className="pa-edit-section-header-toggle"
          aria-expanded={open}
          onClick={toggle}
        >
          <span className="pa-edit-section-title">{title}</span>
          {badge ? <span className="pa-edit-section-badge">{badge}</span> : null}
        </button>
        {headerAction}
        <button
          type="button"
          className="pa-edit-section-chevron-btn"
          aria-label={open ? `Collapse ${title}` : `Expand ${title}`}
          aria-expanded={open}
          onClick={toggle}
        >
          <svg
            className="pa-edit-section-chevron"
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M4 6l4 4 4-4" />
          </svg>
        </button>
      </div>
      {open ? <div className="pa-edit-section-body">{children}</div> : null}
    </section>
  );
}
