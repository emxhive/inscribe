import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { runApplyV2Worker } from './applyV2Worker';
import { ApplyV2SessionStore, sha256 } from './applyV2SessionStore';
import type { PreviewV2InitialFileSnapshot } from './applyV2SessionStore';
import type { PreviewV2ExecutionDTO } from './previewV2Types';
import type { V2OperationStrategy } from '@inscribe/shared';

describe('runApplyV2Worker', () => {
  let tempDir: string;
  let repoRoot: string;
  let store: ApplyV2SessionStore;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'inscribe-apply-worker-test-'));
    repoRoot = path.join(tempDir, 'repo');
    fs.mkdirSync(repoRoot);
    store = new ApplyV2SessionStore();
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  function dummyExec(
    index: number,
    filePath: string,
    strategy: V2OperationStrategy,
    beforeExists: boolean,
    afterExists: boolean,
    beforeContent: string,
    afterContent: string
  ): PreviewV2ExecutionDTO {
    return {
      operationIndex: index,
      blockIndex: index,
      executionId: `exec-${index}`,
      filePath,
      strategy,
      targetScope: { filePath, strategy },
      beforeExists,
      afterExists,
      beforeContent,
      afterContent,
      actualDiffHunks: [],
      beforeFileHash: beforeExists ? sha256(beforeContent) : sha256(''),
      afterFileHash: afterExists ? sha256(afterContent) : sha256(''),
    };
  }

  it('invalid payload returns error', async () => {
    const res = await runApplyV2Worker(null as any, store);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors[0].code).toBe('INVALID_WORKER_PAYLOAD');
    }
  });

  it('rejects blank trustedRepoRoot and previewToken in payload', async () => {
    const res1 = await runApplyV2Worker({ trustedRepoRoot: '', previewToken: 'token' }, store);
    expect(res1.ok).toBe(false);
    if (!res1.ok) {
      expect(res1.errors[0].code).toBe('INVALID_WORKER_PAYLOAD');
    }

    const res2 = await runApplyV2Worker({ trustedRepoRoot: '   ', previewToken: 'token' }, store);
    expect(res2.ok).toBe(false);
    if (!res2.ok) {
      expect(res2.errors[0].code).toBe('INVALID_WORKER_PAYLOAD');
    }

    const res3 = await runApplyV2Worker({ trustedRepoRoot: repoRoot, previewToken: '' }, store);
    expect(res3.ok).toBe(false);
    if (!res3.ok) {
      expect(res3.errors[0].code).toBe('INVALID_WORKER_PAYLOAD');
    }

    const res4 = await runApplyV2Worker({ trustedRepoRoot: repoRoot, previewToken: '   ' }, store);
    expect(res4.ok).toBe(false);
    if (!res4.ok) {
      expect(res4.errors[0].code).toBe('INVALID_WORKER_PAYLOAD');
    }
  });

  it('unknown token returns error', async () => {
    const res = await runApplyV2Worker({ trustedRepoRoot: repoRoot, previewToken: 'unknown-token' }, store);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors[0].type).toBe('session');
      expect(res.errors[0].code).toBe('PREVIEW_SESSION_NOT_FOUND');
    }
  });

  it('expired token returns error', async () => {
    const expiredStore = new ApplyV2SessionStore({ sessionTtlMs: -10 });
    const sessionSummary = expiredStore.createSession(repoRoot, new Map(), []);
    const res = await runApplyV2Worker({ trustedRepoRoot: repoRoot, previewToken: sessionSummary.previewToken }, expiredStore);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors[0].type).toBe('session');
      expect(res.errors[0].code).toBe('PREVIEW_SESSION_NOT_FOUND');
    }
  });

  it('root mismatch returns error', async () => {
    const sessionSummary = store.createSession(repoRoot, new Map(), []);
    const otherRoot = path.join(tempDir, 'other-repo');
    fs.mkdirSync(otherRoot);

    const res = await runApplyV2Worker({ trustedRepoRoot: otherRoot, previewToken: sessionSummary.previewToken }, store);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors[0].type).toBe('session');
      expect(res.errors[0].code).toBe('PREVIEW_SESSION_ROOT_MISMATCH');
    }
  });

  it('successful create apply', async () => {
    const initial = new Map<string, PreviewV2InitialFileSnapshot>([
      ['new.txt', { exists: false, content: '', hash: sha256('') }],
    ]);
    const execs = [
      dummyExec(0, 'new.txt', 'create_file', false, true, '', 'created content'),
    ];
    const sessionSummary = store.createSession(repoRoot, initial, execs);

    const res = await runApplyV2Worker({ trustedRepoRoot: repoRoot, previewToken: sessionSummary.previewToken }, store);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.appliedFileCount).toBe(1);
      expect(res.historyEntries.length).toBe(1);
      expect(res.historyEntries[0].mode).toBe('create_file');
    }
    expect(fs.readFileSync(path.join(repoRoot, 'new.txt'), 'utf8')).toBe('created content');
  });

  it('successful replace apply', async () => {
    fs.writeFileSync(path.join(repoRoot, 'edit.txt'), 'original text');
    const initial = new Map<string, PreviewV2InitialFileSnapshot>([
      ['edit.txt', { exists: true, content: 'original text', hash: sha256('original text') }],
    ]);
    const execs = [
      dummyExec(0, 'edit.txt', 'replace_file', true, true, 'original text', 'updated text'),
    ];
    const sessionSummary = store.createSession(repoRoot, initial, execs);

    const res = await runApplyV2Worker({ trustedRepoRoot: repoRoot, previewToken: sessionSummary.previewToken }, store);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.appliedFileCount).toBe(1);
      expect(res.historyEntries.length).toBe(1);
      expect(res.historyEntries[0].mode).toBe('replace_file');
    }
    expect(fs.readFileSync(path.join(repoRoot, 'edit.txt'), 'utf8')).toBe('updated text');
  });

  it('successful delete apply', async () => {
    fs.writeFileSync(path.join(repoRoot, 'del.txt'), 'content');
    const initial = new Map<string, PreviewV2InitialFileSnapshot>([
      ['del.txt', { exists: true, content: 'content', hash: sha256('content') }],
    ]);
    const execs = [
      dummyExec(0, 'del.txt', 'delete_file', true, false, 'content', ''),
    ];
    const sessionSummary = store.createSession(repoRoot, initial, execs);

    const res = await runApplyV2Worker({ trustedRepoRoot: repoRoot, previewToken: sessionSummary.previewToken }, store);
    expect(res.ok).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, 'del.txt'))).toBe(false);
  });

  it('token cannot be reused after successful apply', async () => {
    const initial = new Map<string, PreviewV2InitialFileSnapshot>([
      ['new.txt', { exists: false, content: '', hash: sha256('') }],
    ]);
    const execs = [
      dummyExec(0, 'new.txt', 'create_file', false, true, '', 'created content'),
    ];
    const sessionSummary = store.createSession(repoRoot, initial, execs);

    const res1 = await runApplyV2Worker({ trustedRepoRoot: repoRoot, previewToken: sessionSummary.previewToken }, store);
    expect(res1.ok).toBe(true);

    const res2 = await runApplyV2Worker({ trustedRepoRoot: repoRoot, previewToken: sessionSummary.previewToken }, store);
    expect(res2.ok).toBe(false);
    if (!res2.ok) {
      expect(res2.errors[0].code).toBe('PREVIEW_SESSION_NOT_FOUND');
    }
  });

  it('token cannot be reused after drift failure', async () => {
    fs.writeFileSync(path.join(repoRoot, 'drift.txt'), 'live text');

    const initial = new Map<string, PreviewV2InitialFileSnapshot>([
      ['drift.txt', { exists: false, content: '', hash: sha256('') }],
    ]);
    const execs = [
      dummyExec(0, 'drift.txt', 'create_file', false, true, '', 'created content'),
    ];
    const sessionSummary = store.createSession(repoRoot, initial, execs);

    const res1 = await runApplyV2Worker({ trustedRepoRoot: repoRoot, previewToken: sessionSummary.previewToken }, store);
    expect(res1.ok).toBe(false);
    if (!res1.ok) {
      expect(res1.errors[0].code).toBe('WORKSPACE_DRIFT');
    }

    const res2 = await runApplyV2Worker({ trustedRepoRoot: repoRoot, previewToken: sessionSummary.previewToken }, store);
    expect(res2.ok).toBe(false);
    if (!res2.ok) {
      expect(res2.errors[0].code).toBe('PREVIEW_SESSION_NOT_FOUND');
    }
  });

  it('same-file sequential preview collapses to one final disk write and one history entry', async () => {
    fs.writeFileSync(path.join(repoRoot, 'seq.txt'), 'start');
    const initial = new Map<string, PreviewV2InitialFileSnapshot>([
      ['seq.txt', { exists: true, content: 'start', hash: sha256('start') }],
    ]);
    const execs = [
      dummyExec(0, 'seq.txt', 'replace_file', true, true, 'start', 'step1'),
      dummyExec(1, 'seq.txt', 'replace_file', true, true, 'step1', 'step2'),
      dummyExec(2, 'seq.txt', 'replace_file', true, true, 'step2', 'final'),
    ];
    const sessionSummary = store.createSession(repoRoot, initial, execs);

    const res = await runApplyV2Worker({ trustedRepoRoot: repoRoot, previewToken: sessionSummary.previewToken }, store);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.appliedFileCount).toBe(1);
      expect(res.historyEntries.length).toBe(1);
      expect(res.historyEntries[0].mode).toBe('replace_file');
    }
    expect(fs.readFileSync(path.join(repoRoot, 'seq.txt'), 'utf8')).toBe('final');
  });

  it('replace_node preview applies as replace_file history', async () => {
    fs.writeFileSync(path.join(repoRoot, 'code.ts'), 'original code');
    const initial = new Map<string, PreviewV2InitialFileSnapshot>([
      ['code.ts', { exists: true, content: 'original code', hash: sha256('original code') }],
    ]);
    const execs = [
      dummyExec(0, 'code.ts', 'replace_node', true, true, 'original code', 'new code'),
    ];
    const sessionSummary = store.createSession(repoRoot, initial, execs);

    const res = await runApplyV2Worker({ trustedRepoRoot: repoRoot, previewToken: sessionSummary.previewToken }, store);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.historyEntries.length).toBe(1);
      expect(res.historyEntries[0].mode).toBe('replace_file');
    }
  });

  it('no-op token succeeds with zero history entries', async () => {
    const sessionSummary = store.createSession(repoRoot, new Map(), []);
    const res = await runApplyV2Worker({ trustedRepoRoot: repoRoot, previewToken: sessionSummary.previewToken }, store);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.appliedFileCount).toBe(0);
      expect(res.historyEntries.length).toBe(0);
    }
  });

  it('sanitizes engine error messages and hides sensitive details', async () => {
    fs.writeFileSync(path.join(repoRoot, 'drift.txt'), 'live changed text');
    const initial = new Map<string, PreviewV2InitialFileSnapshot>([
      ['drift.txt', { exists: true, content: 'original text', hash: sha256('original text') }],
    ]);
    const execs = [
      dummyExec(0, 'drift.txt', 'replace_file', true, true, 'original text', 'updated text'),
    ];
    const sessionSummary = store.createSession(repoRoot, initial, execs);

    const res = await runApplyV2Worker({ trustedRepoRoot: repoRoot, previewToken: sessionSummary.previewToken }, store);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors[0].code).toBe('WORKSPACE_DRIFT');
      expect(res.errors[0].message).toBe('Workspace changed after preview. Preview the changes again.');
      expect(res.errors[0].message).not.toContain('original text');
      expect(res.errors[0].message).not.toContain('live changed text');
    }
  });

  it('maps path safety error to INVALID_WORKSPACE_PATH', async () => {
    fs.writeFileSync(path.join(repoRoot, 'regular-file.txt'), 'content');
    const initial = new Map<string, PreviewV2InitialFileSnapshot>([
      ['regular-file.txt/nested.txt', { exists: false, content: '', hash: sha256('') }],
    ]);
    const execs = [
      dummyExec(0, 'regular-file.txt/nested.txt', 'create_file', false, true, '', 'nested content'),
    ];
    const sessionSummary = store.createSession(repoRoot, initial, execs);

    const res = await runApplyV2Worker({ trustedRepoRoot: repoRoot, previewToken: sessionSummary.previewToken }, store);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors[0].type).toBe('workspace');
      expect(res.errors[0].code).toBe('INVALID_WORKSPACE_PATH');
      expect(res.errors[0].message).toBe('Workspace path is invalid.');
      expect(res.errors[0].filePath).toBe('regular-file.txt/nested.txt');
    }
  });
});
