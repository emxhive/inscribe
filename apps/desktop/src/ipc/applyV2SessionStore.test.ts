import { describe, expect, it } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import {
  ApplyV2SessionStore,
  collapseExecutions,
  canonicalizeRepoRoot,
  PreviewV2InitialFileSnapshot,
  sha256,
} from './applyV2SessionStore';
import type { PreviewV2ExecutionDTO } from './previewV2Types';
import type { V2OperationStrategy } from '@inscribe/shared';


describe('ApplyV2SessionStore', () => {
  const mockRoot = os.tmpdir();
  const canonicalRoot = canonicalizeRepoRoot(mockRoot);

  const dummyExec = (
    index: number,
    filePath: string,
    strategy: V2OperationStrategy,
    beforeExists: boolean,
    afterExists: boolean,
    beforeContent: string,
    afterContent: string
  ): PreviewV2ExecutionDTO => ({
    operationIndex: index,
    executionId: `exec-${index}`,
    filePath,
    strategy,
    targetScope: {
      filePath,
      strategy,
      selector: {
        path: [{ kind: 'function', name: 'myFunc' }],
        startsWith: 'some code',
      },
      lineRange: { startLine: 1, endLine: 5 },
      beforeRange: { start: 0, end: 10 },
      afterRange: { start: 0, end: 12 },
    },
    beforeExists,
    afterExists,
    beforeContent,
    afterContent,
    actualDiffHunks: [
      {
        id: 'h1',
        kind: 'replace',
        oldRange: { start: 0, end: 5 },
        newRange: { start: 0, end: 6 },
        oldText: 'hello',
        newText: 'world1',
        oldStartLine: 1,
        oldEndLine: 1,
        newStartLine: 1,
        newEndLine: 1,
      },
    ],
    beforeFileHash: beforeExists ? sha256(beforeContent) : sha256(''),
    afterFileHash: afterExists ? sha256(afterContent) : sha256(''),
  });

  describe('Root Canonicalization', () => {
    it('existing equivalent paths canonicalize identically', () => {
      const p1 = canonicalizeRepoRoot(mockRoot);
      const p2 = canonicalizeRepoRoot(mockRoot + '/../' + path.basename(mockRoot));
      expect(p1).toBe(p2);
    });

    it('missing root rejected', () => {
      expect(() => canonicalizeRepoRoot('/non/existent/path/dir')).toThrow(
        'INVALID_REPO_ROOT'
      );
    });

    it('file path used as root rejected', () => {
      const tempFile = path.join(mockRoot, `temp-repo-test-${Date.now()}.txt`);
      fs.writeFileSync(tempFile, 'hello');
      try {
        expect(() => canonicalizeRepoRoot(tempFile)).toThrow('INVALID_REPO_ROOT');
      } finally {
        fs.unlinkSync(tempFile);
      }
    });
  });

  describe('Mutation Collapse and Invalidation Checks', () => {
    it('create collapse', () => {
      const initial = new Map<string, PreviewV2InitialFileSnapshot>([
        ['new.txt', { exists: false, content: '', hash: sha256('') }],
      ]);
      const execs = [
        dummyExec(0, 'new.txt', 'create_file', false, true, '', 'hello'),
      ];
      const collapsed = collapseExecutions(initial, execs);
      expect(collapsed.length).toBe(1);
      expect(collapsed[0].type).toBe('create');
      expect(collapsed[0].afterContent).toBe('hello');
    });

    it('replace collapse', () => {
      const initial = new Map<string, PreviewV2InitialFileSnapshot>([
        ['edit.txt', { exists: true, content: 'original', hash: sha256('original') }],
      ]);
      const execs = [
        dummyExec(0, 'edit.txt', 'replace_file', true, true, 'original', 'modified'),
      ];
      const collapsed = collapseExecutions(initial, execs);
      expect(collapsed.length).toBe(1);
      expect(collapsed[0].type).toBe('replace');
      expect(collapsed[0].beforeContent).toBe('original');
      expect(collapsed[0].afterContent).toBe('modified');
    });

    it('delete collapse', () => {
      const initial = new Map<string, PreviewV2InitialFileSnapshot>([
        ['del.txt', { exists: true, content: 'exists', hash: sha256('exists') }],
      ]);
      const execs = [
        dummyExec(0, 'del.txt', 'delete_file', true, false, 'exists', ''),
      ];
      const collapsed = collapseExecutions(initial, execs);
      expect(collapsed.length).toBe(1);
      expect(collapsed[0].type).toBe('delete');
      expect(collapsed[0].beforeExists).toBe(true);
      expect(collapsed[0].afterExists).toBe(false);
    });

    it('unchanged omitted', () => {
      const initial = new Map<string, PreviewV2InitialFileSnapshot>([
        ['same.txt', { exists: true, content: 'same', hash: sha256('same') }],
      ]);
      const execs = [
        dummyExec(0, 'same.txt', 'replace_text', true, true, 'same', 'same'),
      ];
      const collapsed = collapseExecutions(initial, execs);
      expect(collapsed.length).toBe(0);
    });

    it('sequential same-file executions collapse to final state', () => {
      const initial = new Map<string, PreviewV2InitialFileSnapshot>([
        ['seq.txt', { exists: true, content: 'start', hash: sha256('start') }],
      ]);
      const execs = [
        dummyExec(0, 'seq.txt', 'replace_text', true, true, 'start', 'step1'),
        dummyExec(1, 'seq.txt', 'replace_text', true, true, 'step1', 'step2'),
        dummyExec(2, 'seq.txt', 'replace_text', true, true, 'step2', 'final'),
      ];
      const collapsed = collapseExecutions(initial, execs);
      expect(collapsed.length).toBe(1);
      expect(collapsed[0].type).toBe('replace');
      expect(collapsed[0].beforeContent).toBe('start');
      expect(collapsed[0].afterContent).toBe('final');
    });

    it('missing initial snapshot rejected', () => {
      const initial = new Map<string, PreviewV2InitialFileSnapshot>();
      const execs = [
        dummyExec(0, 'missing.txt', 'create_file', false, true, '', 'hello'),
      ];
      expect(() => collapseExecutions(initial, execs)).toThrow(
        'PREVIEW_SESSION_INVALID_PLAN'
      );
    });

    it('broken sequential chain rejected', () => {
      const initial = new Map<string, PreviewV2InitialFileSnapshot>([
        ['broken.txt', { exists: true, content: 'start', hash: sha256('start') }],
      ]);
      const execs = [
        dummyExec(0, 'broken.txt', 'replace_text', true, true, 'start', 'step1'),
        // Gap here: step2 starts with 'start' instead of 'step1'
        dummyExec(1, 'broken.txt', 'replace_text', true, true, 'start', 'step2'),
      ];
      expect(() => collapseExecutions(initial, execs)).toThrow(
        'PREVIEW_SESSION_INVALID_PLAN'
      );
    });

    it('impossible false -> false changed state rejected', () => {
      const initial = new Map<string, PreviewV2InitialFileSnapshot>([
        ['not-here.txt', { exists: false, content: '', hash: sha256('') }],
      ]);
      const execs = [
        dummyExec(0, 'not-here.txt', 'delete_file', false, false, '', 'secret'),
      ];
      // Force custom hash mismatch
      execs[0].afterFileHash = sha256('secret');

      expect(() => collapseExecutions(initial, execs)).toThrow(
        'PREVIEW_SESSION_INVALID_PLAN'
      );
    });

    it('snapshot hash-content mismatch rejected', () => {
      const initial = new Map<string, PreviewV2InitialFileSnapshot>([
        ['bad.txt', { exists: true, content: 'content', hash: 'bad-hash' }],
      ]);
      const execs = [
        dummyExec(0, 'bad.txt', 'replace_file', true, true, 'content', 'modified'),
      ];
      expect(() => collapseExecutions(initial, execs)).toThrow(
        'PREVIEW_SESSION_INVALID_PLAN'
      );
    });

    it('execution before hash-content mismatch rejected', () => {
      const initial = new Map<string, PreviewV2InitialFileSnapshot>([
        ['file.txt', { exists: true, content: 'start', hash: sha256('start') }],
      ]);
      const execs = [
        dummyExec(0, 'file.txt', 'replace_file', true, true, 'start', 'next'),
      ];
      execs[0].beforeFileHash = 'bad-hash';
      expect(() => collapseExecutions(initial, execs)).toThrow(
        'PREVIEW_SESSION_INVALID_PLAN'
      );
    });

    it('execution after hash-content mismatch rejected', () => {
      const initial = new Map<string, PreviewV2InitialFileSnapshot>([
        ['file.txt', { exists: true, content: 'start', hash: sha256('start') }],
      ]);
      const execs = [
        dummyExec(0, 'file.txt', 'replace_file', true, true, 'start', 'next'),
      ];
      execs[0].afterFileHash = 'bad-hash';
      expect(() => collapseExecutions(initial, execs)).toThrow(
        'PREVIEW_SESSION_INVALID_PLAN'
      );
    });

    it('absent state with non-empty content rejected', () => {
      const initial = new Map<string, PreviewV2InitialFileSnapshot>([
        ['absent.txt', { exists: false, content: 'should-be-empty', hash: sha256('should-be-empty') }],
      ]);
      const execs = [
        dummyExec(0, 'absent.txt', 'create_file', false, true, '', 'next'),
      ];
      expect(() => collapseExecutions(initial, execs)).toThrow(
        'PREVIEW_SESSION_INVALID_PLAN'
      );
    });
  });

  describe('Token Generation and Properties', () => {
    it('token is 64-character hex', () => {
      const store = new ApplyV2SessionStore();
      const s = store.createSession(mockRoot, new Map(), []);
      expect(s.previewToken).toHaveLength(64);
      expect(/^[0-9a-f]{64}$/.test(s.previewToken)).toBe(true);
    });

    it('tokens differ', () => {
      const store = new ApplyV2SessionStore();
      const s1 = store.createSession(mockRoot, new Map(), []);
      const s2 = store.createSession(mockRoot, new Map(), []);
      expect(s1.previewToken).not.toBe(s2.previewToken);
    });

    it('canonical repo-root binding and root mismatch checks', () => {
      const store = new ApplyV2SessionStore();
      const s1 = store.createSession(mockRoot, new Map(), []);

      const tempDir = fs.mkdtempSync(path.join(mockRoot, 'inscribe-mismatch-test-'));
      try {
        const canonicalTemp = canonicalizeRepoRoot(tempDir);
        expect(() => store.consumeSession(s1.previewToken, canonicalTemp)).toThrow(
          'PREVIEW_SESSION_ROOT_MISMATCH'
        );
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe('Store Lifecycle and Coexistence', () => {
    it('consumed token removed', () => {
      const store = new ApplyV2SessionStore();
      const s = store.createSession(mockRoot, new Map(), []);

      const session = store.consumeSession(s.previewToken, mockRoot);
      expect(session.token).toBe(s.previewToken);

      expect(() => store.consumeSession(s.previewToken, mockRoot)).toThrow(
        'PREVIEW_SESSION_NOT_FOUND'
      );
    });

    it('unknown token rejected', () => {
      const store = new ApplyV2SessionStore();
      expect(() => store.consumeSession('unknown-token-key-which-is-invalid', mockRoot)).toThrow(
        'PREVIEW_SESSION_NOT_FOUND'
      );
    });

    it('TTL expiry', () => {
      const store = new ApplyV2SessionStore({ sessionTtlMs: -1 });
      const s = store.createSession(mockRoot, new Map(), []);
      expect(() => store.consumeSession(s.previewToken, mockRoot)).toThrow(
        'PREVIEW_SESSION_NOT_FOUND'
      );
    });

    it('expired cleanup', () => {
      const store = new ApplyV2SessionStore({ sessionTtlMs: -100 });
      store.createSession(mockRoot, new Map(), []);
      expect(store.getStoreSize()).toBe(1);

      store.cleanupExpired();
      expect(store.getStoreSize()).toBe(0);
    });

    it('same-root new preview supersedes old token', () => {
      const store = new ApplyV2SessionStore();
      const s1 = store.createSession(mockRoot, new Map(), []);
      expect(store.getStoreSize()).toBe(1);

      const s2 = store.createSession(mockRoot, new Map(), []);
      expect(store.getStoreSize()).toBe(1);

      expect(() => store.consumeSession(s1.previewToken, mockRoot)).toThrow(
        'PREVIEW_SESSION_NOT_FOUND'
      );

      const session = store.consumeSession(s2.previewToken, mockRoot);
      expect(session.token).toBe(s2.previewToken);
    });

    it('failed replacement does not destroy the prior valid token', () => {
      const store = new ApplyV2SessionStore({ maxActiveSessions: 1 });
      const s1 = store.createSession(mockRoot, new Map(), []);

      // Attempt to create a new session under a separate root where count will exceed limit
      const tempDir = fs.mkdtempSync(path.join(mockRoot, 'inscribe-tx-test-'));
      try {
        const canonicalTemp = canonicalizeRepoRoot(tempDir);
        // Exceeds maxActiveSessions (1), so it throws CAPACITY_EXCEEDED
        expect(() => store.createSession(canonicalTemp, new Map(), [])).toThrow(
          'PREVIEW_SESSION_CAPACITY_EXCEEDED'
        );

        // Prior root s1 remains valid!
        const session = store.consumeSession(s1.previewToken, mockRoot);
        expect(session.token).toBe(s1.previewToken);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('different-root sessions coexist', () => {
      const store = new ApplyV2SessionStore();
      const tempDir = fs.mkdtempSync(path.join(mockRoot, 'inscribe-session-test-'));

      try {
        const canonicalTemp = canonicalizeRepoRoot(tempDir);
        const s1 = store.createSession(mockRoot, new Map(), []);
        const s2 = store.createSession(canonicalTemp, new Map(), []);

        expect(store.getStoreSize()).toBe(2);

        const session1 = store.consumeSession(s1.previewToken, mockRoot);
        expect(session1.token).toBe(s1.previewToken);

        const session2 = store.consumeSession(s2.previewToken, canonicalTemp);
        expect(session2.token).toBe(s2.previewToken);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('20 distinct roots enforced without silent eviction', () => {
      const store = new ApplyV2SessionStore({ maxActiveSessions: 20 });
      const dirs: string[] = [];
      try {
        for (let i = 0; i < 20; i++) {
          const dir = fs.mkdtempSync(path.join(mockRoot, `inscribe-cap-test-${i}-`));
          dirs.push(dir);
          const canonical = canonicalizeRepoRoot(dir);
          store.createSession(canonical, new Map(), []);
        }
        expect(store.getStoreSize()).toBe(20);

        const dir21 = fs.mkdtempSync(path.join(mockRoot, 'inscribe-cap-test-21-'));
        dirs.push(dir21);
        const canonical21 = canonicalizeRepoRoot(dir21);
        expect(() => store.createSession(canonical21, new Map(), [])).toThrow(
          'PREVIEW_SESSION_CAPACITY_EXCEEDED'
        );

        expect(store.getStoreSize()).toBe(20);
      } finally {
        for (const dir of dirs) {
          fs.rmSync(dir, { recursive: true, force: true });
        }
      }
    });

    it('stored session is isolated from caller mutation', () => {
      const store = new ApplyV2SessionStore();
      const initial = new Map<string, PreviewV2InitialFileSnapshot>([
        ['test.txt', { exists: true, content: 'original', hash: sha256('original') }],
      ]);
      const execs = [
        dummyExec(0, 'test.txt', 'replace_file', true, true, 'original', 'modified'),
      ];

      const s = store.createSession(mockRoot, initial, execs);

      // Mutate caller collections including deep selector path, lineRange, diff hunk ranges
      initial.set('test.txt', { exists: true, content: 'mutated', hash: sha256('mutated') });
      execs[0].afterContent = 'mutated';
      execs[0].targetScope.selector!.path[0].name = 'mutatedFunc';
      execs[0].targetScope.lineRange!.startLine = 999;
      execs[0].actualDiffHunks[0].oldRange.start = 999;

      // Consume session
      const session = store.consumeSession(s.previewToken, mockRoot);
      const snapshot = session.initialFiles.get('test.txt');
      expect(snapshot?.content).toBe('original');
      expect(session.executions[0].afterContent).toBe('modified');
      expect(session.executions[0].targetScope.selector!.path[0].name).toBe('myFunc');
      expect(session.executions[0].targetScope.lineRange!.startLine).toBe(1);
      expect(session.executions[0].actualDiffHunks[0].oldRange.start).toBe(0);
    });

    it('stored session matchMetadata is isolated from caller mutation', () => {
      const store = new ApplyV2SessionStore();
      const initial = new Map<string, PreviewV2InitialFileSnapshot>([
        ['test.txt', { exists: true, content: 'original', hash: sha256('original') }],
      ]);
      const exec = dummyExec(0, 'test.txt', 'replace_text', true, true, 'original', 'modified');
      exec.targetScope.matchMetadata = {
        kind: 'fallback',
        score: 0.95,
        resolvedRange: { start: 0, end: 8 },
        fallbackReason: 'exact_not_found',
        unmatchedSoftTokens: ['\'']
      };

      const s = store.createSession(mockRoot, initial, [exec]);

      // Mutate
      exec.targetScope.matchMetadata.score = 0.5;
      exec.targetScope.matchMetadata.resolvedRange.start = 999;
      exec.targetScope.matchMetadata.unmatchedSoftTokens![0] = '"';

      // Consume
      const session = store.consumeSession(s.previewToken, mockRoot);
      const metadata = session.executions[0].targetScope.matchMetadata;
      expect(metadata).toBeDefined();
      expect(metadata?.kind).toBe('fallback');
      expect(metadata?.score).toBe(0.95);
      expect(metadata?.resolvedRange.start).toBe(0);
      expect(metadata?.unmatchedSoftTokens).toEqual(['\'']);
    });

    it('store A creates token, store B is new instance and cannot consume', () => {
      const storeA = new ApplyV2SessionStore();
      const storeB = new ApplyV2SessionStore();

      const s = storeA.createSession(mockRoot, new Map(), []);
      expect(() => storeB.consumeSession(s.previewToken, mockRoot)).toThrow(
        'PREVIEW_SESSION_NOT_FOUND'
      );
    });
  });
});
