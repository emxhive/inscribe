import { describe, expect, it, vi } from 'vitest';
import type { Operation } from '@inscribe/shared';

describe('applyChanges boundary', () => {
  it('uses preflightOperations and writeExecutions for normal apply', async () => {
    vi.resetModules();
    const operation: Operation = {
      type: 'create_file',
      file: 'file.txt',
      content: 'content\n',
      blockIndex: 0,
    };
    const execution = {
      kind: 'file_content' as const,
      mode: 'create_file' as const,
      operation,
      beforeExists: false,
      beforeContent: '',
      afterExists: true,
      afterContent: 'content\n',
      operationIndex: 0,
      resolvedPath: 'resolved/file.txt',
    };
    const preflightOperations = vi.fn(() => [execution]);
    const writeExecutions = vi.fn();

    vi.doMock('../src/preflight/preflight', () => ({
      preflightOperations,
    }));
    vi.doMock('../src/apply/writeExecutions', () => ({
      writeExecutions,
    }));

    const { applyChanges } = await import('../src/apply/applyChanges');
    const result = applyChanges({ operations: [operation] }, 'repo-root');

    expect(result.success).toBe(true);
    expect(preflightOperations).toHaveBeenCalledWith([operation], 'repo-root');
    expect(writeExecutions).toHaveBeenCalledWith([execution], 'repo-root');
  });
});
