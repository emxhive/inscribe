import { describe, it, expect } from 'vitest';
import { resolveOperation } from '../../src/v2/execution/resolveOperation';
import { hashContent } from '../../src/v2/execution/virtualFileState';

describe('V2 file operations', () => {
  it('creates a new file successfully', async () => {
    const virtualState = new Map();
    const payload = {
      strategy: 'create_file' as const,
      filePath: 'test.ts',
      content: 'hello world'
    };
    const execution = await resolveOperation(payload, virtualState);

    expect(execution.strategy).toBe('create_file');
    expect(execution.beforeExists).toBe(false);
    expect(execution.afterExists).toBe(true);
    expect(execution.beforeContent).toBe('');
    expect(execution.afterContent).toBe('hello world');
    expect(execution.actualDiffHunks.length).toBe(1);
    expect(execution.beforeFileHash).toBe(hashContent(''));
    expect(execution.afterFileHash).toBe(hashContent('hello world'));
    expect(execution.targetScope.beforeRange).toBeUndefined();
    expect(execution.targetScope.afterRange).toEqual({ start: 0, end: 11 });
  });

  it('fails to create a file if it already exists', async () => {
    const virtualState = new Map([
      ['test.ts', { content: 'existing', exists: true }]
    ]);
    const payload = {
      strategy: 'create_file' as const,
      filePath: 'test.ts',
      content: 'hello world'
    };
    await expect(resolveOperation(payload, virtualState)).rejects.toThrow('File already exists');
  });

  it('replaces an existing file successfully', async () => {
    const content = 'existing content';
    const virtualState = new Map([
      ['test.ts', { content, exists: true }]
    ]);
    const payload = {
      strategy: 'replace_file' as const,
      filePath: 'test.ts',
      content: 'new content'
    };
    const execution = await resolveOperation(payload, virtualState);

    expect(execution.strategy).toBe('replace_file');
    expect(execution.beforeExists).toBe(true);
    expect(execution.afterExists).toBe(true);
    expect(execution.beforeContent).toBe(content);
    expect(execution.afterContent).toBe('new content');
    expect(execution.actualDiffHunks.length).toBe(1);
    expect(execution.targetScope.beforeRange).toEqual({ start: 0, end: 16 });
    expect(execution.targetScope.afterRange).toEqual({ start: 0, end: 11 });
  });

  it('fails to replace a file if it does not exist', async () => {
    const virtualState = new Map();
    const payload = {
      strategy: 'replace_file' as const,
      filePath: 'test.ts',
      content: 'hello world'
    };
    await expect(resolveOperation(payload, virtualState)).rejects.toThrow('File does not exist');
  });

  it('deletes an existing file successfully', async () => {
    const content = 'existing content';
    const virtualState = new Map([
      ['test.ts', { content, exists: true }]
    ]);
    const payload = {
      strategy: 'delete_file' as const,
      filePath: 'test.ts',
      content: ''
    };
    const execution = await resolveOperation(payload, virtualState);

    expect(execution.strategy).toBe('delete_file');
    expect(execution.beforeExists).toBe(true);
    expect(execution.afterExists).toBe(false);
    expect(execution.beforeContent).toBe(content);
    expect(execution.afterContent).toBe('');
    expect(execution.actualDiffHunks.length).toBe(1);
    expect(execution.targetScope.beforeRange).toEqual({ start: 0, end: 16 });
    expect(execution.targetScope.afterRange).toBeUndefined();
  });

  it('fails to delete a file if it does not exist', async () => {
    const virtualState = new Map();
    const payload = {
      strategy: 'delete_file' as const,
      filePath: 'test.ts',
      content: ''
    };
    await expect(resolveOperation(payload, virtualState)).rejects.toThrow('File does not exist');
  });
});
