export interface FontFamilyOption {
  value: string;
  label: string;
}

/** Preset stacks for the font family dropdown (Figma-style). */
export const FONT_FAMILY_PRESETS: FontFamilyOption[] = [
  { value: 'Inter, system-ui, sans-serif', label: 'Inter' },
  { value: 'system-ui, sans-serif', label: 'System UI' },
  {
    value: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    label: 'System',
  },
  { value: 'Georgia, "Times New Roman", Times, serif', label: 'Georgia' },
  { value: '"Times New Roman", Times, serif', label: 'Times New Roman' },
  { value: 'Arial, Helvetica, sans-serif', label: 'Arial' },
  { value: 'Helvetica, Arial, sans-serif', label: 'Helvetica' },
  { value: '"JetBrains Mono", ui-monospace, monospace', label: 'JetBrains Mono' },
  { value: 'ui-monospace, monospace', label: 'Monospace' },
];

const PLACEHOLDER_VALUE = '';

export function primaryFontName(fontFamily: string): string {
  const first = fontFamily.split(',')[0]?.trim() ?? '';
  return first.replace(/^["']|["']$/g, '');
}

/** Match computed font-family to a preset value, or return custom stack. */
export function resolveFontFamilySelectValue(fontFamily: string): {
  selectValue: string;
  options: FontFamilyOption[];
} {
  const trimmed = fontFamily.trim();
  if (!trimmed) {
    return {
      selectValue: PLACEHOLDER_VALUE,
      options: FONT_FAMILY_PRESETS,
    };
  }

  const primary = primaryFontName(trimmed).toLowerCase();

  const exact = FONT_FAMILY_PRESETS.find(
    (p) => p.value === trimmed || primaryFontName(p.value).toLowerCase() === primary
  );
  if (exact) {
    return { selectValue: exact.value, options: FONT_FAMILY_PRESETS };
  }

  const partial = FONT_FAMILY_PRESETS.find((p) => {
    const presetPrimary = primaryFontName(p.value).toLowerCase();
    return (
      trimmed.toLowerCase().includes(presetPrimary) ||
      presetPrimary.includes(primary)
    );
  });
  if (partial) {
    return { selectValue: partial.value, options: FONT_FAMILY_PRESETS };
  }

  return {
    selectValue: trimmed,
    options: [
      ...FONT_FAMILY_PRESETS,
      { value: trimmed, label: primaryFontName(trimmed) || 'Custom' },
    ],
  };
}

export { PLACEHOLDER_VALUE as FONT_FAMILY_PLACEHOLDER };
