import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createHash } from 'crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyPreparedFileMutations,
  type PreparedFileMutation,
} from '../apply/applyPreparedFileMutations';
import { getHistoryEntries } from '../repo/historyStore';
import * as historyStore from '../repo/historyStore';
import type { HistoryEntry } from '@inscribe/shared';
import { previewV2RestoreAction, restoreV2Action } from './v2HistoryRestore';

function hash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

function mutation(filePath: string, beforeContent: string, afterContent: string): PreparedFileMutation {
  return {
    filePath,
    type: 'replace',
    beforeExists: true,
    afterExists: true,
    beforeContent,
    afterContent,
    beforeFileHash: hash(beforeContent),
    afterFileHash: hash(afterContent),
  };
}

function createMutation(filePath: string, afterContent: string): PreparedFileMutation {
  return {
    filePath,
    type: 'create',
    beforeExists: false,
    afterExists: true,
    beforeContent: '',
    afterContent,
    beforeFileHash: hash(''),
    afterFileHash: hash(afterContent),
  };
}

function deleteMutation(filePath: string, beforeContent: string): PreparedFileMutation {
  return {
    filePath,
    type: 'delete',
    beforeExists: true,
    afterExists: false,
    beforeContent,
    afterContent: '',
    beforeFileHash: hash(beforeContent),
    afterFileHash: hash(''),
  };
}

describe('V2 history restore actions', () => {
  let tempDir = '';
  let repoRoot = '';
  let previousUserData: string | undefined;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'inscribe-v2-history-test-'));
    repoRoot = path.join(tempDir, 'repo');
    fs.mkdirSync(repoRoot, { recursive: true });
    previousUserData = process.env.INSCRIBE_USER_DATA;
    process.env.INSCRIBE_USER_DATA = path.join(tempDir, 'user-data');
  });

  afterEach(() => {
    if (previousUserData === undefined) delete process.env.INSCRIBE_USER_DATA;
    else process.env.INSCRIBE_USER_DATA = previousUserData;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('previews and appends a whole-file restore action without rewriting the source action', () => {
    fs.writeFileSync(path.join(repoRoot, 'a.ts'), 'old a');
    fs.writeFileSync(path.join(repoRoot, 'b.ts'), 'old b');

    const applied = applyPreparedFileMutations(repoRoot, [
      mutation('a.ts', 'old a', 'new a'),
      mutation('b.ts', 'old b', 'new b'),
    ]);
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;

    const actionId = applied.historyEntries[0].actionId!;
    const preview = previewV2RestoreAction(actionId, repoRoot);
    expect(preview.eligible).toBe(true);
    expect(preview.files.map((file) => file.restoredState?.content)).toEqual(['old a', 'old b']);

    const restored = restoreV2Action(actionId, repoRoot);
    expect(restored.success).toBe(true);
    expect(fs.readFileSync(path.join(repoRoot, 'a.ts'), 'utf-8')).toBe('old a');
    expect(fs.readFileSync(path.join(repoRoot, 'b.ts'), 'utf-8')).toBe('old b');

    const history = getHistoryEntries(repoRoot);
    expect(history).toHaveLength(4);
    expect(history.filter((entry) => entry.actionType === 'apply')).toHaveLength(2);
    expect(history.filter((entry) => entry.actionType === 'restore')).toHaveLength(2);
    expect(history.filter((entry) => entry.actionType === 'apply').every((entry) => !entry.restoredAt)).toBe(true);

    const restoreActionId = history.find((entry) => entry.actionType === 'restore')?.actionId;
    expect(restoreActionId).toBeTruthy();
    expect(history.filter((entry) => entry.actionType === 'restore').every((entry) => entry.sourceActionId === actionId)).toBe(true);
    expect(history.filter((entry) => entry.actionType === 'restore').map((entry) => entry.sourceEntryId)).toEqual(
      expect.arrayContaining(applied.historyEntries.map((entry) => entry.id)),
    );
    const reversalPreview = previewV2RestoreAction(restoreActionId!, repoRoot);
    expect(reversalPreview.eligible).toBe(true);
    expect(reversalPreview.files.map((file) => file.restoredState?.content)).toEqual(['new a', 'new b']);
    expect(restoreV2Action(restoreActionId!, repoRoot).success).toBe(true);
    expect(fs.readFileSync(path.join(repoRoot, 'a.ts'), 'utf-8')).toBe('new a');
    expect(fs.readFileSync(path.join(repoRoot, 'b.ts'), 'utf-8')).toBe('new b');
    expect(getHistoryEntries(repoRoot)).toHaveLength(6);
  });

  it('rejects the complete restore when one file has drifted', () => {
    fs.writeFileSync(path.join(repoRoot, 'a.ts'), 'old a');
    fs.writeFileSync(path.join(repoRoot, 'b.ts'), 'old b');

    const applied = applyPreparedFileMutations(repoRoot, [
      mutation('a.ts', 'old a', 'new a'),
      mutation('b.ts', 'old b', 'new b'),
    ]);
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;

    fs.writeFileSync(path.join(repoRoot, 'b.ts'), 'user edited b');
    const actionId = applied.historyEntries[0].actionId!;
    const preview = previewV2RestoreAction(actionId, repoRoot);
    expect(preview.eligible).toBe(false);
    expect(preview.files.find((file) => file.file === 'a.ts')?.eligible).toBe(true);
    expect(preview.files.find((file) => file.file === 'b.ts')?.eligible).toBe(false);

    const restored = restoreV2Action(actionId, repoRoot);
    expect(restored.success).toBe(false);
    expect(fs.readFileSync(path.join(repoRoot, 'a.ts'), 'utf-8')).toBe('new a');
    expect(fs.readFileSync(path.join(repoRoot, 'b.ts'), 'utf-8')).toBe('user edited b');
    expect(getHistoryEntries(repoRoot)).toHaveLength(2);
  });

  it('requires the exact V2 post-action file state rather than a matching fragment', () => {
    fs.writeFileSync(path.join(repoRoot, 'main.ts'), 'old value');
    const applied = applyPreparedFileMutations(repoRoot, [mutation('main.ts', 'old value', 'new value')]);
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;

    fs.writeFileSync(path.join(repoRoot, 'main.ts'), 'prefix new value suffix');
    const preview = previewV2RestoreAction(applied.historyEntries[0].actionId!, repoRoot);

    expect(preview.eligible).toBe(false);
    expect(preview.files[0].restoredState).toBeUndefined();
    expect(preview.files[0].error).toContain('exact post-action state');
  });

  it('restores a created file by deleting it, then reverses that restore by recreating it', () => {
    const applied = applyPreparedFileMutations(repoRoot, [createMutation('created.ts', 'created')]);
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(fs.readFileSync(path.join(repoRoot, 'created.ts'), 'utf-8')).toBe('created');

    const actionId = applied.historyEntries[0].actionId!;
    const preview = previewV2RestoreAction(actionId, repoRoot);
    expect(preview.eligible).toBe(true);
    expect(preview.files[0].restoredState).toEqual({ exists: false, content: '' });
    expect(restoreV2Action(actionId, repoRoot).success).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, 'created.ts'))).toBe(false);

    const restoreActionId = getHistoryEntries(repoRoot).find((entry) => entry.actionType === 'restore')?.actionId;
    expect(restoreActionId).toBeTruthy();
    const reversalPreview = previewV2RestoreAction(restoreActionId!, repoRoot);
    expect(reversalPreview.eligible).toBe(true);
    expect(reversalPreview.files[0].restoredState).toEqual({ exists: true, content: 'created' });
    expect(restoreV2Action(restoreActionId!, repoRoot).success).toBe(true);
    expect(fs.readFileSync(path.join(repoRoot, 'created.ts'), 'utf-8')).toBe('created');
  });

  it('restores a deleted file by recreating it', () => {
    fs.writeFileSync(path.join(repoRoot, 'deleted.ts'), 'deleted content');
    const applied = applyPreparedFileMutations(repoRoot, [deleteMutation('deleted.ts', 'deleted content')]);
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(fs.existsSync(path.join(repoRoot, 'deleted.ts'))).toBe(false);

    const preview = previewV2RestoreAction(applied.historyEntries[0].actionId!, repoRoot);
    expect(preview.eligible).toBe(true);
    expect(preview.files[0].restoredState).toEqual({ exists: true, content: 'deleted content' });
    expect(restoreV2Action(applied.historyEntries[0].actionId!, repoRoot).success).toBe(true);
    expect(fs.readFileSync(path.join(repoRoot, 'deleted.ts'), 'utf-8')).toBe('deleted content');
  });

  it('rolls back the restore when appending inverse history fails', () => {
    fs.writeFileSync(path.join(repoRoot, 'rollback.ts'), 'old');
    const applied = applyPreparedFileMutations(repoRoot, [mutation('rollback.ts', 'old', 'new')]);
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;

    const appendSpy = vi.spyOn(historyStore, 'appendHistoryEntries').mockImplementation(() => {
      throw new Error('simulated history write failure');
    });
    try {
      const result = restoreV2Action(applied.historyEntries[0].actionId!, repoRoot);
      expect(result.success).toBe(false);
      expect(result.errors?.[0]).toContain('history persistence failed');
      expect(fs.readFileSync(path.join(repoRoot, 'rollback.ts'), 'utf-8')).toBe('new');
      expect(getHistoryEntries(repoRoot)).toHaveLength(1);
    } finally {
      appendSpy.mockRestore();
    }
  });

  it('does not infer V2 from an unmarked V1 history entry', () => {
    const entry = {
      id: 'legacy-action:0',
      applyId: 'legacy-action',
      file: 'legacy.ts',
      mode: 'replace_file',
      createdAt: new Date().toISOString(),
      restoreOperation: {
        type: 'replace_file',
        file: 'legacy.ts',
        content: 'old',
        blockIndex: 0,
      },
    } as HistoryEntry;
    historyStore.appendHistoryEntries(repoRoot, [entry]);

    expect(getHistoryEntries(repoRoot)[0].protocol).toBeUndefined();
    expect(previewV2RestoreAction(entry.applyId, repoRoot).files).toEqual([]);
  });
});
