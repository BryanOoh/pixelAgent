import { PixelAgent } from './PixelAgent';

export { PixelAgent };
export type { PixelAgentMode, PixelAgentProps } from './PixelAgent';
export type { PixelAgentIconVariant } from './shadow/PixelAgentIcon';

export function isDevEnvironment(): boolean {
  return typeof process !== 'undefined' && process.env.NODE_ENV !== 'production';
}

/**
 * Dev-only wrapper. Renders null in production builds.
 */
export function PixelAgentDev() {
  if (!isDevEnvironment()) return null;
  return <PixelAgent />;
}

export * from '@pixelagent/shared';
