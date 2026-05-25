import type { ApplyPayload, ElementState } from '@pixelagent/shared';

export type PatchContext = Pick<ApplyPayload, 'state' | 'targetScope'>;

const STATE_VARIANT: Partial<Record<ElementState, string>> = {
  hover: 'hover',
  focus: 'focus',
  active: 'active',
  disabled: 'disabled',
};

/** Tailwind patches use md: breakpoint prefix for responsive utilities. */
export function prefixTailwindUtility(className: string, ctx: PatchContext): string {
  let cls = className;
  const variant = STATE_VARIANT[ctx.state];
  if (variant) {
    cls = `${variant}:${cls}`;
  }
  cls = `md:${cls}`;
  return cls;
}

const VARIANT_PREFIXES = [
  'hover:',
  'focus:',
  'active:',
  'disabled:',
  'md:',
  'max-md:',
  'sm:',
  'lg:',
  'xl:',
  '2xl:',
] as const;

export function stripTailwindVariants(className: string): string {
  let cls = className;
  let changed = true;
  while (changed) {
    changed = false;
    for (const prefix of VARIANT_PREFIXES) {
      if (cls.startsWith(prefix)) {
        cls = cls.slice(prefix.length);
        changed = true;
        break;
      }
    }
  }
  return cls;
}

/** Prefix chain Tailwind expects (e.g. `md:hover:` for hover state). */
export function expectedVariantPrefix(ctx: PatchContext): string {
  let prefix = 'md:';
  const stateVariant = STATE_VARIANT[ctx.state];
  if (stateVariant) prefix += `${stateVariant}:`;
  return prefix;
}

export function tailwindClassMatchesContext(className: string, ctx: PatchContext): boolean {
  const expected = expectedVariantPrefix(ctx);
  if (expected) return className.startsWith(expected);
  return !VARIANT_PREFIXES.some((p) => className.startsWith(p));
}

/** CSS rule key inside a stylesheet (class + optional pseudo). */
export function cssRuleKey(className: string, ctx: PatchContext): string {
  const pseudo =
    ctx.state === 'hover'
      ? ':hover'
      : ctx.state === 'focus'
        ? ':focus'
        : ctx.state === 'active'
          ? ':active'
          : ctx.state === 'disabled'
            ? ':disabled'
            : '';
  return `${className}${pseudo}`;
}
