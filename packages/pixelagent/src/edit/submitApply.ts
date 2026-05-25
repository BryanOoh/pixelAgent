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

export function formatApplyFeedback(transport: ApplyTransportResult): string {
  if (transport.mode === 'clipboard') {
    return 'Apply payload copied — paste into your agent or MCP';
  }
  if (transport.mode === 'error') {
    return `Apply failed: ${transport.message}`;
  }

  const { result } = transport;
  if (result.success) {
    const lines =
      result.linesChanged.length > 0 ? `lines ${result.linesChanged.join(', ')}` : 'file updated';
    const warn = result.warnings?.length ? ` · ${result.warnings.length} warning(s)` : '';
    return `Patched ${result.patchedFile} (${lines})${warn}`;
  }

  const warn = result.warnings?.join('; ') ?? 'no changes written';
  return `Apply completed with warnings: ${warn}`;
}
