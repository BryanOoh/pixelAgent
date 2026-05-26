import {
  formatSliderValue,
  PROP_CONTROLS,
  sliderValueForProperty,
} from './propertyControls';

interface PropertyFieldProps {
  property: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Inside a named section — smaller label, no extra uppercase row chrome. */
  compact?: boolean;
}

export function PropertyField({
  property,
  label,
  value,
  onChange,
  compact = false,
}: PropertyFieldProps) {
  const config = PROP_CONTROLS[property] ?? { kind: 'text' as const };
  const numeric = sliderValueForProperty(property, value, config);
  const useSlider = config.kind !== 'text' && numeric !== null;

  const rowClass = compact ? 'pa-prop-row pa-prop-row--compact' : 'pa-prop-row';
  const labelClass = compact ? 'pa-edit-field-label' : 'pa-prop-label';

  if (!useSlider) {
    return (
      <label className={rowClass}>
        <span className={labelClass}>{label}</span>
        <input
          className="pa-input"
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
    );
  }

  const min = config.min ?? 0;
  const max = config.max ?? 100;
  const step = config.step ?? 1;

  const handleSlider = (next: number) => {
    onChange(formatSliderValue(property, next, config));
  };

  return (
    <label className={`${rowClass} pa-prop-row--slider`}>
      <span className={labelClass}>{label}</span>
      <div className="pa-prop-slider-wrap">
        <input
          type="range"
          className="pa-slider"
          min={min}
          max={max}
          step={step}
          value={numeric}
          aria-valuetext={value}
          onChange={(e) => handleSlider(parseFloat(e.target.value))}
        />
        <input
          className="pa-input pa-prop-slider-value"
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={`${label} value`}
        />
      </div>
    </label>
  );
}
