import type { ReactNode } from 'react';

export interface SegmentOption<T extends string> {
  value: T;
  title: string;
  content: ReactNode;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  value?: T;
  ariaLabel: string;
  onChange?: (value: T) => void;
}

/** Single-choice segmented bar (align). */
export function SegmentedControl<T extends string>({
  options,
  value,
  ariaLabel,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <div className="pa-segmented" role="group" aria-label={ariaLabel}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={`pa-segmented-btn ${value === opt.value ? 'pa-segmented-btn--on' : ''}`}
          title={opt.title}
          aria-pressed={value === opt.value}
          aria-label={opt.title}
          onClick={() => onChange?.(opt.value)}
        >
          {opt.content}
        </button>
      ))}
    </div>
  );
}

export interface MultiSegmentOption {
  id: string;
  title: string;
  content: ReactNode;
  pressed: boolean;
}

interface MultiSegmentedControlProps {
  options: MultiSegmentOption[];
  ariaLabel: string;
  onToggle: (id: string) => void;
}

/** Multi-select segmented bar (bold / italic / underline / strike). */
export function MultiSegmentedControl({
  options,
  ariaLabel,
  onToggle,
}: MultiSegmentedControlProps) {
  return (
    <div className="pa-segmented" role="group" aria-label={ariaLabel}>
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          className={`pa-segmented-btn ${opt.pressed ? 'pa-segmented-btn--on' : ''}`}
          title={opt.title}
          aria-pressed={opt.pressed}
          aria-label={opt.title}
          onClick={() => onToggle(opt.id)}
        >
          {opt.content}
        </button>
      ))}
    </div>
  );
}
