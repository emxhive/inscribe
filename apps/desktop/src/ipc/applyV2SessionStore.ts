import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs';
import type { PreviewV2ExecutionDTO } from './previewV2Types';
import type { PreparedFileMutation } from '@inscribe/engine';

export interface PreviewV2InitialFileSnapshot {
  exists: boolean;
  content: string;
  hash: string;
}

export interface PreviewV2Session {
  token: string;
  canonicalRepoRoot: string;
  createdAt: string;
  expiresAt: string;
  initialFiles: Map<string, PreviewV2InitialFileSnapshot>;
  executions: PreviewV2ExecutionDTO[];
  finalMutations: PreparedFileMutation[];
}

export interface StoreSessionEntry {
  session: PreviewV2Session;
  expiresAt: number; // Unix timestamp ms
  canonicalRepoRoot: string;
}

export interface PreviewV2SessionSummary {
  previewToken: string;
  expiresAt: string;
}

export interface SessionStoreConfig {
  sessionTtlMs?: number;      // default 30 mins
  maxActiveSessions?: number; // default 20
}

export function sha256(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

export function canonicalizeRepoRoot(repoRoot: string): string {
  try {
    const resolved = path.resolve(repoRoot);
    const realPath = fs.realpathSync(resolved);
    const stat = fs.statSync(realPath);
    if (!stat.isDirectory()) {
      throw new Error('INVALID_REPO_ROOT');
    }
    return process.platform === 'win32' ? realPath.toLowerCase() : realPath;
  } catch (e: unknown) {
    throw new Error('INVALID_REPO_ROOT');
  }
}

export function cloneSnapshotMap(
  map: Map<string, PreviewV2InitialFileSnapshot>
): Map<string, PreviewV2InitialFileSnapshot> {
  const cloned = new Map<string, PreviewV2InitialFileSnapshot>();
  for (const [k, v] of map.entries()) {
    cloned.set(k, {
      exists: v.exists,
      content: v.content,
      hash: v.hash,
    });
  }
  return cloned;
}

export function cloneExecutions(execs: PreviewV2ExecutionDTO[]): PreviewV2ExecutionDTO[] {
  return execs.map((e) => ({
    operationIndex: e.operationIndex,
    executionId: e.executionId,
    filePath: e.filePath,
    strategy: e.strategy,
    targetScope: {
      filePath: e.targetScope.filePath,
      strategy: e.targetScope.strategy,
      selector: e.targetScope.selector
        ? {
            path: e.targetScope.selector.path.map((segment) => ({ ...segment })),
            startsWith: e.targetScope.selector.startsWith,
          }
        : undefined,
      selectorText: e.targetScope.selectorText,
      lineRange: e.targetScope.lineRange
        ? { ...e.targetScope.lineRange }
        : undefined,
      beforeRange: e.targetScope.beforeRange
        ? { ...e.targetScope.beforeRange }
        : undefined,
      afterRange: e.targetScope.afterRange
        ? { ...e.targetScope.afterRange }
        : undefined,
      matchMetadata: e.targetScope.matchMetadata
        ? {
            kind: e.targetScope.matchMetadata.kind,
            score: e.targetScope.matchMetadata.score,
            resolvedRange: { ...e.targetScope.matchMetadata.resolvedRange },
            fallbackReason: e.targetScope.matchMetadata.fallbackReason,
            unmatchedSoftTokens: e.targetScope.matchMetadata.unmatchedSoftTokens
              ? [...e.targetScope.matchMetadata.unmatchedSoftTokens]
              : undefined,
          }
        : undefined,
    },
    beforeExists: e.beforeExists,
    afterExists: e.afterExists,
    beforeContent: e.beforeContent,
    afterContent: e.afterContent,
    actualDiffHunks: e.actualDiffHunks.map((h) => ({
      id: h.id,
      kind: h.kind,
      oldRange: { ...h.oldRange },
      newRange: { ...h.newRange },
      oldText: h.oldText,
      newText: h.newText,
      oldStartLine: h.oldStartLine,
      oldEndLine: h.oldEndLine,
      newStartLine: h.newStartLine,
      newEndLine: h.newEndLine,
    })),
    beforeFileHash: e.beforeFileHash,
    afterFileHash: e.afterFileHash,
  }));
}

export function collapseExecutions(
  initialFiles: Map<string, PreviewV2InitialFileSnapshot>,
  executions: PreviewV2ExecutionDTO[]
): PreparedFileMutation[] {
  // Hash verification
  for (const snapshot of initialFiles.values()) {
    if (snapshot.hash !== sha256(snapshot.content)) {
      throw new Error('PREVIEW_SESSION_INVALID_PLAN');
    }
    if (!snapshot.exists) {
      if (snapshot.content !== '' || snapshot.hash !== sha256('')) {
        throw new Error('PREVIEW_SESSION_INVALID_PLAN');
      }
    }
  }

  for (const exec of executions) {
    if (exec.beforeFileHash !== sha256(exec.beforeContent)) {
      throw new Error('PREVIEW_SESSION_INVALID_PLAN');
    }
    if (exec.afterFileHash !== sha256(exec.afterContent)) {
      throw new Error('PREVIEW_SESSION_INVALID_PLAN');
    }
    if (!exec.beforeExists) {
      if (exec.beforeContent !== '' || exec.beforeFileHash !== sha256('')) {
        throw new Error('PREVIEW_SESSION_INVALID_PLAN');
      }
    }
    if (!exec.afterExists) {
      if (exec.afterContent !== '' || exec.afterFileHash !== sha256('')) {
        throw new Error('PREVIEW_SESSION_INVALID_PLAN');
      }
    }
  }

  const fileToExecs = new Map<string, PreviewV2ExecutionDTO[]>();
  for (const exec of executions) {
    if (!fileToExecs.has(exec.filePath)) {
      fileToExecs.set(exec.filePath, []);
    }
    fileToExecs.get(exec.filePath)!.push(exec);
  }

  const collapsed: PreparedFileMutation[] = [];

  for (const [filePath, fileExecs] of fileToExecs.entries()) {
    const snapshot = initialFiles.get(filePath);
    if (!snapshot) {
      throw new Error('PREVIEW_SESSION_INVALID_PLAN');
    }

    fileExecs.sort((a, b) => a.operationIndex - b.operationIndex);

    // Verify first execution matches snapshot
    const firstExec = fileExecs[0];
    if (
      firstExec.beforeExists !== snapshot.exists ||
      firstExec.beforeContent !== snapshot.content ||
      firstExec.beforeFileHash !== snapshot.hash
    ) {
      throw new Error('PREVIEW_SESSION_INVALID_PLAN');
    }

    // Verify subsequent execution transitions
    for (let j = 1; j < fileExecs.length; j++) {
      const prev = fileExecs[j - 1];
      const curr = fileExecs[j];
      if (
        curr.beforeExists !== prev.afterExists ||
        curr.beforeContent !== prev.afterContent ||
        curr.beforeFileHash !== prev.afterFileHash
      ) {
        throw new Error('PREVIEW_SESSION_INVALID_PLAN');
      }
    }

    // Verify valid transitions
    for (const exec of fileExecs) {
      if (!exec.beforeExists && !exec.afterExists) {
        if (
          exec.beforeContent !== exec.afterContent ||
          exec.beforeFileHash !== exec.afterFileHash
        ) {
          throw new Error('PREVIEW_SESSION_INVALID_PLAN');
        }
      }
    }

    const lastExec = fileExecs[fileExecs.length - 1];
    const beforeExists = snapshot.exists;
    const beforeContent = snapshot.content;
    const beforeFileHash = snapshot.hash;

    const afterExists = lastExec.afterExists;
    const afterContent = lastExec.afterContent;
    const afterFileHash = lastExec.afterFileHash;

    if (beforeExists === afterExists && beforeContent === afterContent) {
      continue;
    }

    let type: 'create' | 'replace' | 'delete';
    if (!beforeExists && afterExists) {
      type = 'create';
    } else if (beforeExists && afterExists) {
      type = 'replace';
    } else {
      type = 'delete';
    }

    collapsed.push({
      filePath,
      type,
      beforeExists,
      afterExists,
      beforeContent,
      afterContent,
      beforeFileHash,
      afterFileHash,
    });
  }

  return collapsed;
}

export class ApplyV2SessionStore {
  private entries = new Map<string, StoreSessionEntry>();

  private sessionTtlMs: number;
  private maxActiveSessions: number;

  constructor(config?: SessionStoreConfig) {
    this.sessionTtlMs = config?.sessionTtlMs ?? 30 * 60 * 1000;
    this.maxActiveSessions = config?.maxActiveSessions ?? 20;
  }

  public createSession(
    repoRoot: string,
    initialFiles: Map<string, PreviewV2InitialFileSnapshot>,
    executions: PreviewV2ExecutionDTO[]
  ): PreviewV2SessionSummary {
    const now = Date.now();
    this.cleanupExpired();

    const canonicalRoot = canonicalizeRepoRoot(repoRoot);

    const clonedSnapshot = cloneSnapshotMap(initialFiles);
    const clonedExecs = cloneExecutions(executions);
    const finalMutations = collapseExecutions(clonedSnapshot, clonedExecs);

    // Calculate projected count after same-root replacement
    let hasExisting = false;
    for (const entry of this.entries.values()) {
      if (entry.canonicalRepoRoot === canonicalRoot) {
        hasExisting = true;
        break;
      }
    }

    const projectedCount = hasExisting ? this.entries.size : this.entries.size + 1;
    if (projectedCount > this.maxActiveSessions) {
      throw new Error('PREVIEW_SESSION_CAPACITY_EXCEEDED');
    }

    // Perform replacement only after checking capacity
    for (const [token, entry] of this.entries.entries()) {
      if (entry.canonicalRepoRoot === canonicalRoot) {
        this.entries.delete(token);
      }
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAtMs = now + this.sessionTtlMs;
    const expiresAtStr = new Date(expiresAtMs).toISOString();
    const createdAtStr = new Date(now).toISOString();

    const session: PreviewV2Session = {
      token,
      canonicalRepoRoot: canonicalRoot,
      createdAt: createdAtStr,
      expiresAt: expiresAtStr,
      initialFiles: clonedSnapshot,
      executions: clonedExecs,
      finalMutations,
    };

    this.entries.set(token, {
      session,
      expiresAt: expiresAtMs,
      canonicalRepoRoot: canonicalRoot,
    });

    return {
      previewToken: token,
      expiresAt: expiresAtStr,
    };
  }

  public consumeSession(token: string, repoRoot: string): PreviewV2Session {
    this.cleanupExpired();

    const entry = this.entries.get(token);
    if (!entry) {
      throw new Error('PREVIEW_SESSION_NOT_FOUND');
    }

    const now = Date.now();
    if (now > entry.expiresAt) {
      this.entries.delete(token);
      throw new Error('PREVIEW_SESSION_NOT_FOUND');
    }

    const canonicalRoot = canonicalizeRepoRoot(repoRoot);
    if (entry.canonicalRepoRoot !== canonicalRoot) {
      throw new Error('PREVIEW_SESSION_ROOT_MISMATCH');
    }

    this.entries.delete(token);
    return entry.session;
  }

  public cleanupExpired(): void {
    const now = Date.now();
    for (const [token, entry] of this.entries.entries()) {
      if (now > entry.expiresAt) {
        this.entries.delete(token);
      }
    }
  }

  public getStoreSize(): number {
    return this.entries.size;
  }
}

export const defaultApplyV2SessionStore = new ApplyV2SessionStore();
