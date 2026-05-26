interface ToggleOption<T extends string> {
  value: T;
  label: string;
  title?: string;
}

interface ToggleButtonGroupProps<T extends string> {
  options: ToggleOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
}

export function ToggleButtonGroup<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: ToggleButtonGroupProps<T>) {
  return (
    <div className="pa-toggle-group" role="group" aria-label={ariaLabel}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={`pa-toggle-btn ${value === opt.value ? 'pa-toggle-btn--on' : ''}`}
          title={opt.title ?? opt.label}
          aria-pressed={value === opt.value}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

interface MultiToggleProps {
  options: Array<{ id: string; label: string; pressed: boolean; title?: string }>;
  onToggle: (id: string) => void;
  ariaLabel: string;
}

export function MultiToggleButtonGroup({ options, onToggle, ariaLabel }: MultiToggleProps) {
  return (
    <div className="pa-toggle-group" role="group" aria-label={ariaLabel}>
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          className={`pa-toggle-btn ${opt.pressed ? 'pa-toggle-btn--on' : ''}`}
          title={opt.title ?? opt.label}
          aria-pressed={opt.pressed}
          onClick={() => onToggle(opt.id)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
