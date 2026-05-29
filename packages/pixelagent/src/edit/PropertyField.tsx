import type { KeyboardEvent } from 'react';
import {
  formatLength,
  formatSliderValue,
  parseLength,
  PROP_CONTROLS,
  sliderValueForProperty,
  stepForUnit,
} from './propertyControls';
import { clamp, useScrub } from './useScrub';

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
  const scrubbable = config.kind !== 'text' && numeric !== null;

  const rowClass = compact ? 'pa-prop-row pa-prop-row--compact' : 'pa-prop-row';
  const labelClass = compact ? 'pa-edit-field-label' : 'pa-prop-label';

  if (!scrubbable) {
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

  const min = config.min ?? -Infinity;
  const max = config.max ?? Infinity;
  // Length values scrub in their own unit (px/%/em…); step adapts so unitless
  // line-height nudges by 0.1 while px nudges by 1.
  const isLength = config.kind === 'length';
  const step = isLength
    ? stepForUnit(parseLength(value)?.unit ?? '')
    : config.step ?? 1;

  const commit = (next: number) =>
    onChange(
      isLength
        ? formatLength(value, next)
        : formatSliderValue(property, next, config)
    );

  const scrub = useScrub({
    getValue: () => sliderValueForProperty(property, value, config),
    min,
    max,
    step,
    onChange: commit,
    pxPerStep: config.kind === 'opacity' ? 2 : 3,
  });

  const handleArrows = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    const base = sliderValueForProperty(property, value, config);
    if (base === null) return;
    e.preventDefault();
    const dir = e.key === 'ArrowUp' ? 1 : -1;
    commit(clamp(base + dir * step, min, max));
  };

  return (
    <div className={rowClass}>
      <span
        className={`${labelClass} pa-scrub-label${scrub.scrubbing ? ' pa-scrub-label--active' : ''}`}
        title="Drag to adjust"
        {...scrub.handleProps}
      >
        {label}
      </span>
      <input
        className="pa-input pa-prop-scrub-value"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleArrows}
        aria-label={`${label} value`}
        spellCheck={false}
      />
    </div>
  );
}
