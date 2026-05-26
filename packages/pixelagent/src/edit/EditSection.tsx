import { useState, type ReactNode } from 'react';

interface EditSectionProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  badge?: string;
}

export function EditSection({ title, children, defaultOpen = true, badge }: EditSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className={`pa-edit-section ${open ? 'pa-edit-section--open' : ''}`}>
      <button
        type="button"
        className="pa-edit-section-header"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="pa-edit-section-title">{title}</span>
        {badge ? <span className="pa-edit-section-badge">{badge}</span> : null}
        <span className="pa-edit-section-chevron" aria-hidden="true" />
      </button>
      {open ? <div className="pa-edit-section-body">{children}</div> : null}
    </section>
  );
}
