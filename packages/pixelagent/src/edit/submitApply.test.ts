import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ApplyPayload, ApplyVisualDiffResult } from '@pixelagent/shared';
import { submitApply, formatApplyFeedback } from './submitApply';

const PAYLOAD: ApplyPayload = {
  schemaVersion: 1,
  elementSelector: 'button.cta',
  sourceFile: 'src/App.tsx',
  lineNumber: 12,
  targetScope: 'this-instance',
  state: 'normal',
  stylingSystem: 'inline',
  changes: [{ property: 'font-size', oldValue: '14px', newValue: '16px' }],
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('submitApply', () => {
  it('routes through onApply when provided (wins over endpoint)', async () => {
    const result: ApplyVisualDiffResult = {
      success: true,
      patchedFile: 'src/App.tsx',
      linesChanged: [12],
    };
    const onApply = vi.fn().mockResolvedValue(result);
    const transport = await submitApply(PAYLOAD, {
      onApply,
      applyEndpoint: '/__pixelagent/apply',
    });
    expect(onApply).toHaveBeenCalledWith(PAYLOAD);
    expect(transport).toEqual({ mode: 'mcp', result });
  });

  it('POSTs to applyEndpoint when set', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, patchedFile: 'src/App.tsx', linesChanged: [12] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const transport = await submitApply(PAYLOAD, { applyEndpoint: '/__pixelagent/apply' });

    expect(fetchMock).toHaveBeenCalledWith(
      '/__pixelagent/apply',
      expect.objectContaining({ method: 'POST' })
    );
    expect(transport.mode).toBe('mcp');
  });

  it('falls back to clipboard when neither prop is set', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    const transport = await submitApply(PAYLOAD);

    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('elementSelector'));
    expect(transport).toEqual({ mode: 'clipboard' });
  });

  it('reports error when endpoint fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('boom')));
    const transport = await submitApply(PAYLOAD, { applyEndpoint: '/__pixelagent/apply' });
    expect(transport).toEqual({ mode: 'error', message: 'boom' });
  });
});

describe('formatApplyFeedback', () => {
  it('returns "Change applied" on a successful patch with lines changed', () => {
    expect(
      formatApplyFeedback({
        mode: 'mcp',
        result: { success: true, patchedFile: 'src/App.tsx', linesChanged: [12, 13] },
      })
    ).toBe('Change applied');
  });

  it('returns "Apply failed" for clipboard fallback', () => {
    expect(formatApplyFeedback({ mode: 'clipboard' })).toBe('Apply failed');
  });

  it('returns "Apply failed" for transport errors', () => {
    expect(formatApplyFeedback({ mode: 'error', message: 'boom' })).toBe('Apply failed');
  });

  it('returns "Apply failed" when result.success is false', () => {
    expect(
      formatApplyFeedback({
        mode: 'mcp',
        result: { success: false, patchedFile: 'src/App.tsx', linesChanged: [], warnings: ['x'] },
      })
    ).toBe('Apply failed');
  });

  it('returns "Apply failed" when no lines were actually changed', () => {
    expect(
      formatApplyFeedback({
        mode: 'mcp',
        result: { success: true, patchedFile: 'src/App.tsx', linesChanged: [] },
      })
    ).toBe('Apply failed');
  });
});
