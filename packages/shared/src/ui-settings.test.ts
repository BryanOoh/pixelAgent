import { describe, expect, it } from 'vitest';
import { resolvePixelAgentChrome } from './ui-settings.js';

describe('resolvePixelAgentChrome', () => {
  it('uses explicit chrome', () => {
    expect(resolvePixelAgentChrome({ chrome: 'dim', chromeMode: 'frost' }, 'dark')).toBe(
      'dim'
    );
  });

  it('auto picks dim on light host', () => {
    expect(resolvePixelAgentChrome({ chromeMode: 'auto' }, 'light')).toBe('dim');
    expect(resolvePixelAgentChrome({ chromeMode: 'auto' }, 'dark')).toBe('frost');
  });
});
