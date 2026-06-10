import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { HistoryEntry, Operation } from '@inscribe/shared';
import { applyChanges } from '../src/apply/applyChanges';
import { restoreEntry } from '../src/history/restoreEntry';
import { buildRestorePayload } from '../src/history/restoreV2';
import { appendHistoryEntries, getHistoryEntries } from '../src/repo/historyStore';

let workspaceRoot = '';
let repoRoot = '';

beforeEach(() => {
  workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'inscribe-restore-test-'));
  repoRoot = path.join(workspaceRoot, 'repo');
  fs.mkdirSync(repoRoot, { recursive: true });
  process.env.INSCRIBE_USER_DATA = path.join(workspaceRoot, 'user-data');
});

afterEach(() => {
  delete process.env.INSCRIBE_USER_DATA;
  fs.rmSync(workspaceRoot, { recursive: true, force: true });
});

describe('restoreEntry active restore pipeline', () => {
  it('deletes a file created by create_file restore', () => {
    const entry = applyAndStore({
      type: 'create_file',
      file: 'created.txt',
      content: 'created content\n',
      blockIndex: 0,
    });

    const result = restoreStoredEntry(entry);

    expect(result.success).toBe(true);
    expect(fs.existsSync(filePath('created.txt'))).toBe(false);
  });

  it('fails safely when a created file was edited after apply', () => {
    const entry = applyAndStore({
      type: 'create_file',
      file: 'created-edited.txt',
      content: 'created content\n',
      blockIndex: 0,
    });
    fs.writeFileSync(filePath('created-edited.txt'), 'manual edit\n');

    const result = restoreStoredEntry(entry);

    expect(result.success).toBe(false);
    expect(result.errors?.join('\n')).toContain('Unsafe to restore create_file');
    expect(readRepoFile('created-edited.txt')).toBe('manual edit\n');
    expect(getHistoryEntries(repoRoot)[0].restoredAt).toBeUndefined();
  });

  it('uses the stored history payload when request omits the compatibility payload', () => {
    const entry = applyAndStore({
      type: 'create_file',
      file: 'stored-payload.txt',
      content: 'created content\n',
      blockIndex: 0,
    });

    const result = restoreEntry({ entryId: entry.id }, repoRoot);

    expect(result.success).toBe(true);
    expect(fs.existsSync(filePath('stored-payload.txt'))).toBe(false);
  });

  it('rejects a restore request with a mismatched compatibility payload', () => {
    const entry = applyAndStore({
      type: 'create_file',
      file: 'trusted.txt',
      content: 'trusted content\n',
      blockIndex: 0,
    });
    const payload = clonePayload(entry.restorePayload!);
    payload.file = 'other.txt';

    const result = restoreEntry({ entryId: entry.id, payload }, repoRoot);

    expect(result.success).toBe(false);
    expect(result.errors?.join('\n')).toContain('Restore payload mismatch');
    expect(readRepoFile('trusted.txt')).toBe('trusted content\n');
    expect(getHistoryEntries(repoRoot)[0].restoredAt).toBeUndefined();
  });

  it('fails duplicate restore requests', () => {
    const entry = applyAndStore({
      type: 'create_file',
      file: 'duplicate.txt',
      content: 'created content\n',
      blockIndex: 0,
    });

    const first = restoreEntry({ entryId: entry.id }, repoRoot);
    const second = restoreEntry({ entryId: entry.id }, repoRoot);

    expect(first.success).toBe(true);
    expect(second.success).toBe(false);
    expect(second.errors?.join('\n')).toContain('already restored');
  });

  it('recreates a file deleted by delete_file restore', () => {
    fs.writeFileSync(filePath('deleted.txt'), 'previous content\n');
    const entry = applyAndStore({
      type: 'delete_file',
      file: 'deleted.txt',
      content: '',
      blockIndex: 0,
    });

    const result = restoreStoredEntry(entry);

    expect(result.success).toBe(true);
    expect(readRepoFile('deleted.txt')).toBe('previous content\n');
  });

  it('preserves CRLF line endings when recreating a deleted file', () => {
    fs.writeFileSync(filePath('deleted-crlf.txt'), 'first\r\nsecond\r\n');
    const entry = applyAndStore({
      type: 'delete_file',
      file: 'deleted-crlf.txt',
      content: '',
      blockIndex: 0,
    });

    const result = restoreStoredEntry(entry);

    expect(result.success).toBe(true);
    expect(readRepoFile('deleted-crlf.txt')).toBe('first\r\nsecond\r\n');
  });

  it('fails safely when delete_file restore target was recreated with unrelated content', () => {
    fs.writeFileSync(filePath('deleted.txt'), 'previous content\n');
    const entry = applyAndStore({
      type: 'delete_file',
      file: 'deleted.txt',
      content: '',
      blockIndex: 0,
    });
    fs.writeFileSync(filePath('deleted.txt'), 'manual content\n');

    const result = restoreStoredEntry(entry);

    expect(result.success).toBe(false);
    expect(result.errors?.join('\n')).toContain('Unsafe to restore delete_file');
    expect(readRepoFile('deleted.txt')).toBe('manual content\n');
    expect(getHistoryEntries(repoRoot)[0].restoredAt).toBeUndefined();
  });

  it('allows delete_file restore when target already equals payload.oldContent', () => {
    fs.writeFileSync(filePath('deleted.txt'), 'previous content\n');
    const entry = applyAndStore({
      type: 'delete_file',
      file: 'deleted.txt',
      content: '',
      blockIndex: 0,
    });
    fs.writeFileSync(filePath('deleted.txt'), 'previous content\n');

    const result = restoreStoredEntry(entry);

    expect(result.success).toBe(true);
    expect(readRepoFile('deleted.txt')).toBe('previous content\n');
  });

  it('allows delete_file restore when target was recreated empty', () => {
    fs.writeFileSync(filePath('deleted.txt'), 'previous content\n');
    const entry = applyAndStore({
      type: 'delete_file',
      file: 'deleted.txt',
      content: '',
      blockIndex: 0,
    });
    fs.writeFileSync(filePath('deleted.txt'), '');

    const result = restoreStoredEntry(entry);

    expect(result.success).toBe(true);
    expect(readRepoFile('deleted.txt')).toBe('previous content\n');
  });

  it('removes appended content via payload', () => {
    fs.writeFileSync(filePath('append.txt'), 'base\n');
    const entry = applyAndStore({
      type: 'append_file',
      file: 'append.txt',
      content: 'added\n',
      blockIndex: 0,
    });

    const result = restoreStoredEntry(entry);

    expect(result.success).toBe(true);
    expect(readRepoFile('append.txt')).toBe('base\n');
  });

  it('preserves CRLF line endings when removing appended content', () => {
    fs.writeFileSync(filePath('append-crlf.txt'), 'base\r\n');
    const entry = applyAndStore({
      type: 'append_file',
      file: 'append-crlf.txt',
      content: 'added\r\n',
      blockIndex: 0,
    });

    const result = restoreStoredEntry(entry);

    expect(result.success).toBe(true);
    expect(readRepoFile('append-crlf.txt')).toBe('base\r\n');
  });

  it('restores previous full content for replace_file', () => {
    fs.writeFileSync(filePath('replace.txt'), 'old\n');
    const entry = applyAndStore({
      type: 'replace_file',
      file: 'replace.txt',
      content: 'new\n',
      blockIndex: 0,
    });

    const result = restoreStoredEntry(entry);

    expect(result.success).toBe(true);
    expect(readRepoFile('replace.txt')).toBe('old\n');
  });

  it('restores replace_line from payload without START anchor resolution', () => {
    fs.writeFileSync(filePath('line.txt'), 'alpha\nold line\nomega\n');
    const entry = applyAndStore({
      type: 'replace_line',
      file: 'line.txt',
      content: 'new line',
      directives: { START_LINE_EQUALS: 'old line' },
      blockIndex: 0,
    });

    const result = restoreStoredEntry(entry);

    expect(result.success).toBe(true);
    expect(readRepoFile('line.txt')).toBe('alpha\nold line\nomega\n');
  });

  it('restores replace_range from payload without START/END resolution', () => {
    fs.writeFileSync(filePath('range.txt'), 'alpha\nold a\nold b\nomega\n');
    const entry = applyAndStore({
      type: 'replace_range',
      file: 'range.txt',
      content: 'new range',
      directives: { START_LINE_EQUALS: 'old a', END_LINE_EQUALS: 'old b' },
      blockIndex: 0,
    });

    const result = restoreStoredEntry(entry);

    expect(result.success).toBe(true);
    expect(readRepoFile('range.txt')).toBe('alpha\nold a\nold b\nomega\n');
  });

  it('restores replace_between from payload without START/END resolution', () => {
    fs.writeFileSync(filePath('between.txt'), 'alpha\nSTART\nold middle\nEND\nomega\n');
    const entry = applyAndStore({
      type: 'replace_between',
      file: 'between.txt',
      content: 'new middle',
      directives: { START_LINE_EQUALS: 'START', END_LINE_EQUALS: 'END' },
      blockIndex: 0,
    });

    const result = restoreStoredEntry(entry);

    expect(result.success).toBe(true);
    expect(readRepoFile('between.txt')).toBe('alpha\nSTART\nold middle\nEND\nomega\n');
  });

  it('restores replace_symbol from payload without NAME lookup', () => {
    fs.writeFileSync(
      filePath('symbol.ts'),
      'export function target() {\n  return 1;\n}\n'
    );
    const entry = applyAndStore({
      type: 'replace_symbol',
      file: 'symbol.ts',
      content: 'export function target() {\n  return 2;\n}',
      directives: { NAME: 'target' },
      blockIndex: 0,
    });

    const result = restoreStoredEntry(entry);

    expect(result.success).toBe(true);
    expect(readRepoFile('symbol.ts')).toBe('export function target() {\n  return 1;\n}\n');
  });

  it('fails safely instead of guessing when payload restore is ambiguous', () => {
    const payload = buildRestorePayload('append_file', 'ambiguous.txt', 'A', 'AX');
    fs.writeFileSync(filePath('ambiguous.txt'), 'XX');
    appendHistoryEntries(repoRoot, [{
      id: 'ambiguous:0',
      applyId: 'ambiguous',
      file: 'ambiguous.txt',
      mode: 'append_file',
      createdAt: new Date().toISOString(),
      restoreOperation: {
        type: 'append_file',
        file: 'ambiguous.txt',
        content: 'A',
        blockIndex: 0,
      },
      restorePayload: payload,
      blockIndex: 0,
    }]);

    const result = restoreEntry({ entryId: 'ambiguous:0', payload }, repoRoot);

    expect(result.success).toBe(false);
    expect(result.errors?.join('\n')).toContain('Unsafe to restore');
    expect(readRepoFile('ambiguous.txt')).toBe('XX');
  });

  it('marks the original history entry restored without creating a new history entry', () => {
    const entry = applyAndStore({
      type: 'create_file',
      file: 'created.txt',
      content: 'created\n',
      blockIndex: 0,
    });

    const result = restoreStoredEntry(entry);
    const stored = getHistoryEntries(repoRoot);

    expect(result.success).toBe(true);
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe(entry.id);
    expect(stored[0].restoredAt).toEqual(expect.any(String));
    expect(result.historyEntries).toHaveLength(1);
  });

  it('uses restore path policy from payload.mode instead of synthetic inverse mode', () => {
    fs.mkdirSync(filePath('src'), { recursive: true });
    fs.mkdirSync(filePath('outside'), { recursive: true });
    const entry = applyAndStore({
      type: 'create_file',
      file: 'outside/created.txt',
      content: 'created outside indexed paths\n',
      blockIndex: 0,
    });

    const result = restoreStoredEntry(entry);

    expect(result.success).toBe(true);
    expect(fs.existsSync(filePath('outside/created.txt'))).toBe(false);
  });

  it('keeps restore orchestration out of applyChanges', () => {
    const restoreEntrySource = fs.readFileSync(
      path.join(__dirname, '../src/history/restoreEntry.ts'),
      'utf-8'
    );
    const applySource = fs.readFileSync(
      path.join(__dirname, '../src/apply/applyChanges.ts'),
      'utf-8'
    );

    expect(restoreEntrySource).toContain('writeExecutions([execution], repoRoot)');
    expect(restoreEntrySource).not.toContain('applyChanges');
    expect(restoreEntrySource).not.toContain('ApplyPlan');
    expect(applySource).not.toContain('restorePayload');
    expect(applySource).not.toContain('resolveRestoreExecution');
  });
});

function applyAndStore(operation: Operation): HistoryEntry {
  const result = applyChanges({ operations: [operation] }, repoRoot);
  expect(result.success).toBe(true);
  expect(result.historyEntries).toHaveLength(1);
  appendHistoryEntries(repoRoot, result.historyEntries ?? []);
  return result.historyEntries![0];
}

function restoreStoredEntry(entry: HistoryEntry) {
  expect(entry.restorePayload).toBeDefined();
  return restoreEntry(
    {
      entryId: entry.id,
      payload: entry.restorePayload!,
    },
    repoRoot
  );
}

function filePath(relativePath: string): string {
  return path.join(repoRoot, relativePath);
}

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(filePath(relativePath), 'utf-8');
}

function clonePayload(payload: NonNullable<HistoryEntry['restorePayload']>) {
  return JSON.parse(JSON.stringify(payload)) as NonNullable<HistoryEntry['restorePayload']>;
}
