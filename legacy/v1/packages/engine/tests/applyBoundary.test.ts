import { describe, expect, it, vi } from 'vitest';
import type { Operation } from '@inscribe/shared';

describe('applyChanges boundary', () => {
  it('uses preflightOperations, writeExecutions, and appendHistoryEntries for normal apply', async () => {
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
      canonicalPath: 'resolved/file.txt',
    };
    const preflightOperations = vi.fn(() => [execution]);
    const writeExecutions = vi.fn();
    const appendHistoryEntries = vi.fn();

    vi.doMock('../src/preflight/preflight', () => ({
      preflightOperations,
    }));
    vi.doMock('../src/apply/writeExecutions', () => ({
      writeExecutions,
      rollbackExecutions: vi.fn(() => []),
    }));
    vi.doMock('../src/repo/historyStore', () => ({
      appendHistoryEntries,
    }));

    const { applyChanges } = await import('../src/apply/applyChanges');
    const result = applyChanges({ operations: [operation] }, 'repo-root');

    expect(result.success).toBe(true);
    expect(preflightOperations).toHaveBeenCalledWith([operation], 'repo-root');
    expect(writeExecutions).toHaveBeenCalledWith([execution], 'repo-root');
    expect(appendHistoryEntries).toHaveBeenCalledWith(
      'repo-root',
      expect.arrayContaining([
        expect.objectContaining({
          file: 'file.txt',
          mode: 'create_file',
          blockIndex: 0,
        }),
      ]),
    );
    expect(result.historyEntries).toHaveLength(1);
  });

  it('rolls back writes and returns failure when history persistence fails', async () => {
    vi.resetModules();
    const operation: Operation = {
      type: 'replace_file',
      file: 'file.txt',
      content: 'content\n',
      blockIndex: 0,
    };
    const execution = {
      kind: 'file_content' as const,
      mode: 'replace_file' as const,
      operation,
      beforeExists: true,
      beforeContent: 'before\n',
      afterExists: true,
      afterContent: 'content\n',
      operationIndex: 0,
      resolvedPath: 'resolved/file.txt',
      canonicalPath: 'resolved/file.txt',
    };
    const preflightOperations = vi.fn(() => [execution]);
    const writeExecutions = vi.fn();
    const rollbackExecutions = vi.fn(() => []);
    const appendHistoryEntries = vi.fn(() => {
      throw new Error('history denied');
    });

    vi.doMock('../src/preflight/preflight', () => ({
      preflightOperations,
    }));
    vi.doMock('../src/apply/writeExecutions', () => ({
      writeExecutions,
      rollbackExecutions,
    }));
    vi.doMock('../src/repo/historyStore', () => ({
      appendHistoryEntries,
    }));

    const { applyChanges } = await import('../src/apply/applyChanges');
    const result = applyChanges({ operations: [operation] }, 'repo-root');

    expect(result.success).toBe(false);
    expect(result.errors?.join('\n')).toContain('History persistence failed after disk writes');
    expect(result.errors?.join('\n')).toContain('Disk writes were rolled back');
    expect(writeExecutions).toHaveBeenCalledWith([execution], 'repo-root');
    expect(rollbackExecutions).toHaveBeenCalledWith([execution], 'repo-root');
    expect(result.historyEntries).toBeUndefined();
  });

  it('returns failure without history entries when writes fail', async () => {
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
      canonicalPath: 'resolved/file.txt',
    };
    const preflightOperations = vi.fn(() => [execution]);
    const writeExecutions = vi.fn(() => {
      throw new Error('write denied');
    });
    const appendHistoryEntries = vi.fn();

    vi.doMock('../src/preflight/preflight', () => ({
      preflightOperations,
    }));
    vi.doMock('../src/apply/writeExecutions', () => ({
      writeExecutions,
      rollbackExecutions: vi.fn(() => []),
    }));
    vi.doMock('../src/repo/historyStore', () => ({
      appendHistoryEntries,
    }));

    const { applyChanges } = await import('../src/apply/applyChanges');
    const result = applyChanges({ operations: [operation] }, 'repo-root');

    expect(result.success).toBe(false);
    expect(result.errors?.join('\n')).toContain('write denied');
    expect(result.historyEntries).toBeUndefined();
    expect(appendHistoryEntries).not.toHaveBeenCalled();
  });
});
