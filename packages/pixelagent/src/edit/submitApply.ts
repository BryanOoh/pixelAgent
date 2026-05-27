import type { ApplyPayload, ApplyVisualDiffResult } from '@pixelagent/shared';
import { copyToClipboard } from '@pixelagent/shared';

export type ApplyTransportResult =
  | { mode: 'mcp'; result: ApplyVisualDiffResult }
  | { mode: 'clipboard' }
  | { mode: 'error'; message: string };

export interface SubmitApplyOptions {
  applyEndpoint?: string;
  onApply?: (payload: ApplyPayload) => Promise<ApplyVisualDiffResult | null>;
}

export async function submitApply(
  payload: ApplyPayload,
  options: SubmitApplyOptions = {}
): Promise<ApplyTransportResult> {
  if (options.onApply) {
    try {
      const result = await options.onApply(payload);
      if (result) return { mode: 'mcp', result };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { mode: 'error', message };
    }
  }

  const endpoint = options.applyEndpoint;
  if (endpoint) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload }),
      });
      const data = (await res.json()) as ApplyVisualDiffResult & { error?: string };
      if (!res.ok) {
        return { mode: 'error', message: data.error ?? res.statusText };
      }
      return { mode: 'mcp', result: data };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { mode: 'error', message };
    }
  }

  await copyToClipboard(JSON.stringify(payload, null, 2));
  return { mode: 'clipboard' };
}

/**
 * Two outcomes only: applied or failed. Anything that didn't actually write
 * source (errors, clipboard fallback, partial-success without lines changed)
 * collapses to "Apply failed". Detail goes to the console for debugging.
 */
export function formatApplyFeedback(transport: ApplyTransportResult): string {
  if (
    transport.mode === 'mcp' &&
    transport.result.success &&
    transport.result.linesChanged.length > 0
  ) {
    if (transport.result.warnings?.length) {
      console.warn('[pixelagent] Apply succeeded with warnings:', transport.result.warnings);
    }
    return 'Change applied';
  }

  if (transport.mode === 'error') {
    console.error('[pixelagent] Apply failed:', transport.message);
  } else if (transport.mode === 'mcp') {
    console.warn('[pixelagent] Apply reported no changes:', transport.result);
  } else {
    console.warn('[pixelagent] Apply fell back to clipboard — no source patched');
  }
  return 'Apply failed';
}
