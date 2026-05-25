/**
 * PixelAgent chrome / UI settings.
 * Add new optional fields here as features ship (density, labels, motion, etc.).
 */

/** Glass material on panels — `frost` on dark hosts, `dim` on bright hosts. */
export type PixelAgentChrome = 'frost' | 'dim';

export type PixelAgentChromeMode = 'auto' | 'frost' | 'dim';

export type HostTheme = 'light' | 'dark';

export interface PixelAgentUiSettings {
  /** Explicit chrome; overrides `chromeMode`. */
  chrome?: PixelAgentChrome;

  /**
   * Default `auto`: `dim` when host is light, `frost` when host is dark.
   */
  chromeMode?: PixelAgentChromeMode;

  /** Host document theme attribute (default `data-theme`). */
  hostThemeAttribute?: string;
  hostThemeLightValue?: string;
  hostThemeDarkValue?: string;
}

export const DEFAULT_PIXEL_AGENT_UI_SETTINGS: Readonly<
  Required<
    Pick<
      PixelAgentUiSettings,
      'chromeMode' | 'hostThemeAttribute' | 'hostThemeLightValue' | 'hostThemeDarkValue'
    >
  >
> &
  PixelAgentUiSettings = {
  chromeMode: 'auto',
  hostThemeAttribute: 'data-theme',
  hostThemeLightValue: 'light',
  hostThemeDarkValue: 'dark',
};

export function readHostThemeFromDocument(
  settings?: PixelAgentUiSettings
): HostTheme | null {
  if (typeof document === 'undefined') return null;

  const merged = { ...DEFAULT_PIXEL_AGENT_UI_SETTINGS, ...settings };
  const value = document.documentElement.getAttribute(merged.hostThemeAttribute);
  if (value === merged.hostThemeLightValue) return 'light';
  if (value === merged.hostThemeDarkValue) return 'dark';
  return null;
}

export function applyHostThemeToDocument(
  theme: HostTheme,
  settings?: PixelAgentUiSettings
): void {
  if (typeof document === 'undefined') return;
  const merged = { ...DEFAULT_PIXEL_AGENT_UI_SETTINGS, ...settings };
  const attrValue = theme === 'light' ? merged.hostThemeLightValue : merged.hostThemeDarkValue;
  document.documentElement.setAttribute(merged.hostThemeAttribute, attrValue);
}

export function resolvePixelAgentChrome(
  settings: PixelAgentUiSettings | undefined,
  hostTheme: HostTheme
): PixelAgentChrome {
  const merged = { ...DEFAULT_PIXEL_AGENT_UI_SETTINGS, ...settings };

  if (merged.chrome === 'frost' || merged.chrome === 'dim') {
    return merged.chrome;
  }

  const mode = merged.chromeMode ?? 'auto';
  if (mode === 'frost') return 'frost';
  if (mode === 'dim') return 'dim';
  return hostTheme === 'light' ? 'dim' : 'frost';
}

export function pixelAgentRootAttributes(chrome: PixelAgentChrome): Record<string, string> {
  return { 'data-pa-chrome': chrome };
}
