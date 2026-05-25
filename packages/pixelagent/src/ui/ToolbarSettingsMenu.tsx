import { useEffect, useRef } from 'react';
import type { HostTheme, PixelAgentChrome } from '@pixelagent/shared';
import { GlassButton, GlassPanel } from '../glass';
import { MoonIcon, SunIcon } from './icons';

interface ToolbarSettingsMenuProps {
  open: boolean;
  onClose: () => void;
  hostTheme: HostTheme;
  chrome: PixelAgentChrome;
  onToggleHostTheme: () => void;
}

export function ToolbarSettingsMenu({
  open,
  onClose,
  hostTheme,
  chrome,
  onToggleHostTheme,
}: ToolbarSettingsMenuProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      if ((target as Element).closest?.('[data-pa-settings-trigger]')) return;
      onClose();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('mousedown', onPointerDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('mousedown', onPointerDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div ref={panelRef} className="pa-settings-menu" role="dialog" aria-label="PixelAgent settings">
      <GlassPanel variant="popover" className="pa-settings-menu-panel">
        <div className="pa-settings-menu-inner">
          <header className="pa-settings-menu-header">
            <h4 className="pa-settings-menu-title">Settings</h4>
            <p className="pa-settings-menu-subtitle">Appearance and chrome</p>
          </header>

          <section className="pa-settings-section">
            <span className="pa-settings-section-label">Host theme</span>
            <div className="pa-settings-row">
              <span className="pa-settings-row-value">
                {hostTheme === 'dark' ? 'Dark canvas' : 'Light canvas'}
              </span>
              <GlassButton
                variant="icon"
                onClick={onToggleHostTheme}
                aria-label={
                  hostTheme === 'dark' ? 'Switch host to light theme' : 'Switch host to dark theme'
                }
                title={hostTheme === 'dark' ? 'Light theme' : 'Dark theme'}
              >
                {hostTheme === 'dark' ? <SunIcon /> : <MoonIcon />}
              </GlassButton>
            </div>
          </section>

          <section className="pa-settings-section">
            <span className="pa-settings-section-label">Glass chrome</span>
            <p className="pa-settings-hint">
              {chrome === 'dim'
                ? 'Dim gray glass for readability on bright pages.'
                : 'Frosted glass for dark pages.'}
              {' '}
              (auto)
            </p>
          </section>
        </div>
      </GlassPanel>
    </div>
  );
}
