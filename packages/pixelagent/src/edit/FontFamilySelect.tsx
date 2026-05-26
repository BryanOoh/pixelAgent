import { useMemo } from 'react';
import { FONT_FAMILY_PLACEHOLDER, resolveFontFamilySelectValue } from './fontFamilies.js';

interface FontFamilySelectProps {
  value: string;
  onChange: (value: string) => void;
}

export function FontFamilySelect({ value, onChange }: FontFamilySelectProps) {
  const { selectValue, options } = useMemo(
    () => resolveFontFamilySelectValue(value),
    [value]
  );

  return (
    <label className="pa-edit-stack-field">
      <span className="pa-edit-field-label">Font family</span>
      <select
        className="pa-select pa-font-family-select"
        value={selectValue || FONT_FAMILY_PLACEHOLDER}
        onChange={(e) => {
          const next = e.target.value;
          if (next && next !== FONT_FAMILY_PLACEHOLDER) onChange(next);
        }}
      >
        <option value={FONT_FAMILY_PLACEHOLDER} disabled>
          Select font style
        </option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}
