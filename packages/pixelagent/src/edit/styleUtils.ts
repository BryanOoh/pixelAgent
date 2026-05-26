/** Numeric font-weight for bold toggle (400 ↔ 700). */
export function isBoldWeight(value: string): boolean {
  const n = parseInt(value.trim(), 10);
  if (Number.isFinite(n)) return n >= 600;
  return value.trim() === 'bold' || value.trim() === 'bolder';
}

export function toggleBoldWeight(value: string): string {
  return isBoldWeight(value) ? '400' : '700';
}

export function isItalicStyle(value: string): boolean {
  return value.trim() === 'italic' || value.trim() === 'oblique';
}

export function toggleItalicStyle(value: string): string {
  return isItalicStyle(value) ? 'normal' : 'italic';
}

export function hasTextDecoration(value: string, token: 'underline' | 'line-through'): boolean {
  return value.split(/\s+/).includes(token);
}

export function toggleTextDecoration(
  value: string,
  token: 'underline' | 'line-through'
): string {
  const parts = new Set(
    value
      .trim()
      .split(/\s+/)
      .filter((p) => p && p !== 'none')
  );
  if (parts.has(token)) parts.delete(token);
  else parts.add(token);
  return parts.size === 0 ? 'none' : Array.from(parts).join(' ');
}

export type TextAlignValue = 'left' | 'center' | 'right' | 'justify';

export function normalizeTextAlign(value: string): TextAlignValue {
  const v = value.trim() as TextAlignValue;
  if (v === 'center' || v === 'right' || v === 'justify') return v;
  return 'left';
}

export { colorToHexInput } from './colorModel.js';
