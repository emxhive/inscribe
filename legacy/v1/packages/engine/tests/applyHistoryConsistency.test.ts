import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { applyChanges } from '../src/apply/applyChanges';
import { getHistoryEntries } from '../src/repo/historyStore';

let workspaceRoot = '';
let repoRoot = '';

beforeEach(() => {
  workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'inscribe-apply-history-'));
  repoRoot = path.join(workspaceRoot, 'repo');
  fs.mkdirSync(repoRoot, { recursive: true });
  process.env.INSCRIBE_USER_DATA = path.join(workspaceRoot, 'user-data');
});

afterEach(() => {
  delete process.env.INSCRIBE_USER_DATA;
  fs.rmSync(workspaceRoot, { recursive: true, force: true });
});

describe('applyChanges history consistency', () => {
  it('writes files and persists history for a normal apply', () => {
    const result = applyChanges({
      operations: [{
        type: 'create_file',
        file: 'created.txt',
        content: 'created\n',
        blockIndex: 0,
      }],
    }, repoRoot);

    expect(result.success).toBe(true);
    expect(readRepoFile('created.txt')).toBe('created\n');
    expect(result.historyEntries).toHaveLength(1);

    const stored = getHistoryEntries(repoRoot);
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      file: 'created.txt',
      mode: 'create_file',
      blockIndex: 0,
    });
  });
});

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf-8');
}
