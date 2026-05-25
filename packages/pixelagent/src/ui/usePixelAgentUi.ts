import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  applyHostThemeToDocument,
  DEFAULT_PIXEL_AGENT_UI_SETTINGS,
  pixelAgentRootAttributes,
  readHostThemeFromDocument,
  resolvePixelAgentChrome,
  type HostTheme,
  type PixelAgentUiSettings,
} from '@pixelagent/shared';

export interface UsePixelAgentUiOptions {
  ui?: PixelAgentUiSettings;
  hostTheme?: HostTheme;
  onHostThemeChange?: (theme: HostTheme) => void;
}

export function usePixelAgentUi({
  ui,
  hostTheme: controlledHostTheme,
  onHostThemeChange,
}: UsePixelAgentUiOptions) {
  const mergedUi = useMemo(
    () => ({ ...DEFAULT_PIXEL_AGENT_UI_SETTINGS, ...ui }),
    [ui]
  );

  const [internalHostTheme, setInternalHostTheme] = useState<HostTheme>(
    () => controlledHostTheme ?? readHostThemeFromDocument(mergedUi) ?? 'dark'
  );

  const [settingsOpen, setSettingsOpen] = useState(false);

  const hostTheme = controlledHostTheme ?? internalHostTheme;

  useEffect(() => {
    if (controlledHostTheme !== undefined) return;

    const sync = () => {
      const read = readHostThemeFromDocument(mergedUi);
      if (read) setInternalHostTheme(read);
    };

    sync();
    const attr = mergedUi.hostThemeAttribute;
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: [attr],
    });
    return () => observer.disconnect();
  }, [controlledHostTheme, mergedUi]);

  const chrome = useMemo(
    () => resolvePixelAgentChrome(mergedUi, hostTheme),
    [mergedUi, hostTheme]
  );

  const toggleHostTheme = useCallback(() => {
    const next: HostTheme = hostTheme === 'dark' ? 'light' : 'dark';
    if (onHostThemeChange) {
      onHostThemeChange(next);
      return;
    }
    setInternalHostTheme(next);
    applyHostThemeToDocument(next, mergedUi);
  }, [hostTheme, onHostThemeChange, mergedUi]);

  const toggleSettings = useCallback(() => {
    setSettingsOpen((open) => !open);
  }, []);

  return {
    chrome,
    rootAttributes: pixelAgentRootAttributes(chrome),
    hostTheme,
    toggleHostTheme,
    settingsOpen,
    setSettingsOpen,
    toggleSettings,
    uiSettings: mergedUi,
  };
}
