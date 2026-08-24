import { createHash } from 'crypto';
import * as fs from 'fs';
import type { HistoryEntry } from '@inscribe/shared';
import { buildRestoreEntry } from '../history/restoreHistory';
import { enforcePathPolicy } from '../paths/pathPolicy';
import { appendHistoryEntries } from '../repo/historyStore';
import { rollbackExecutions, writeExecutions } from './writeExecutions';
import type { PreflightExecution } from '../preflight/preflight';

export interface PreparedFileMutation {
  filePath: string;
  type: 'create' | 'replace' | 'delete';
  beforeExists: boolean;
  afterExists: boolean;
  beforeContent: string;
  afterContent: string;
  beforeFileHash: string;
  afterFileHash: string;
}

export type PreparedMutationApplyErrorCode =
  | 'INVALID_PREPARED_MUTATION'
  | 'CANONICAL_PATH_COLLISION'
  | 'WORKSPACE_DRIFT'
  | 'FILE_READ_FAILED'
  | 'BINARY_FILE_NOT_SUPPORTED'
  | 'INVALID_UTF8_FILE'
  | 'APPLY_WRITE_FAILED'
  | 'HISTORY_PERSISTENCE_FAILED'
  | 'ROLLBACK_FAILED'
  | 'INVALID_WORKSPACE_PATH';

export type PreparedMutationApplyResult =
  | {
      ok: true;
      appliedFileCount: number;
      historyEntries: HistoryEntry[];
    }
  | {
      ok: false;
      errors: Array<{
        code: PreparedMutationApplyErrorCode;
        message: string;
        filePath?: string;
      }>;
    };

function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

function buildApplyId(timestamp: string): string {
  return `${timestamp}-${Math.random().toString(36).slice(2, 10)}`;
}

type ReadLiveFileStateResult =
  | { ok: true; exists: false; content: '' }
  | { ok: true; exists: true; content: string }
  | { ok: false; code: PreparedMutationApplyErrorCode; message: string; filePath: string };

function readLiveFileState(resolvedPath: string, filePath: string): ReadLiveFileStateResult {
  try {
    if (!fs.existsSync(resolvedPath)) {
      return { ok: true, exists: false, content: '' };
    }

    let stat: fs.Stats;
    try {
      stat = fs.statSync(resolvedPath);
    } catch (e) {
      return {
        ok: false,
        code: 'FILE_READ_FAILED',
        message: 'Workspace file could not be read.',
        filePath,
      };
    }

    if (stat.isDirectory()) {
      return {
        ok: false,
        code: 'WORKSPACE_DRIFT',
        message: 'Workspace changed after preview. Preview the changes again.',
        filePath,
      };
    }

    let buf: Buffer;
    try {
      buf = fs.readFileSync(resolvedPath);
    } catch (e) {
      return {
        ok: false,
        code: 'FILE_READ_FAILED',
        message: 'Workspace file could not be read.',
        filePath,
      };
    }

    if (buf.includes(0)) {
      return {
        ok: false,
        code: 'BINARY_FILE_NOT_SUPPORTED',
        message: 'Binary files are not supported.',
        filePath,
      };
    }

    try {
      const decoder = new TextDecoder('utf-8', { fatal: true });
      const content = decoder.decode(buf);
      return { ok: true, exists: true, content };
    } catch (e) {
      return {
        ok: false,
        code: 'INVALID_UTF8_FILE',
        message: 'Workspace file is not valid UTF-8 text.',
        filePath,
      };
    }
  } catch (e) {
    return {
      ok: false,
      code: 'FILE_READ_FAILED',
      message: 'Workspace file could not be read.',
      filePath,
    };
  }
}

export function applyPreparedFileMutations(
  repoRoot: string,
  mutations: PreparedFileMutation[],
): PreparedMutationApplyResult {
  // Defensive validation of the entry point arguments
  if (
    typeof repoRoot !== 'string' ||
    repoRoot.trim().length === 0 ||
    !Array.isArray(mutations)
  ) {
    return {
      ok: false,
      errors: [{
        code: 'INVALID_PREPARED_MUTATION',
        message: 'Invalid prepared mutation plan.',
      }],
    };
  }

  if (mutations.length === 0) {
    return {
      ok: true,
      appliedFileCount: 0,
      historyEntries: [],
    };
  }

  const EMPTY_HASH = hashContent('');

  // 1. Validate every mutation object and field shape
  for (const mutation of mutations) {
    if (!mutation || typeof mutation !== 'object') {
      return {
        ok: false,
        errors: [{ code: 'INVALID_PREPARED_MUTATION', message: 'Mutation is not a valid object.' }],
      };
    }
    if (
      typeof mutation.filePath !== 'string' ||
      mutation.filePath.trim().length === 0 ||
      !['create', 'replace', 'delete'].includes(mutation.type) ||
      typeof mutation.beforeExists !== 'boolean' ||
      typeof mutation.afterExists !== 'boolean' ||
      typeof mutation.beforeContent !== 'string' ||
      typeof mutation.afterContent !== 'string' ||
      typeof mutation.beforeFileHash !== 'string' ||
      typeof mutation.afterFileHash !== 'string'
    ) {
      return {
        ok: false,
        errors: [{ code: 'INVALID_PREPARED_MUTATION', message: 'Invalid mutation fields or types.' }],
      };
    }

    // 2. Validate internal invariants
    if (mutation.beforeFileHash !== hashContent(mutation.beforeContent)) {
      return {
        ok: false,
        errors: [{
          code: 'INVALID_PREPARED_MUTATION',
          message: `beforeFileHash mismatch for ${mutation.filePath}.`,
          filePath: mutation.filePath,
        }],
      };
    }
    if (mutation.afterFileHash !== hashContent(mutation.afterContent)) {
      return {
        ok: false,
        errors: [{
          code: 'INVALID_PREPARED_MUTATION',
          message: `afterFileHash mismatch for ${mutation.filePath}.`,
          filePath: mutation.filePath,
        }],
      };
    }

    if (!mutation.beforeExists) {
      if (mutation.beforeContent !== '' || mutation.beforeFileHash !== EMPTY_HASH) {
        return {
          ok: false,
          errors: [{
            code: 'INVALID_PREPARED_MUTATION',
            message: `Absent before-state must have empty content and empty hash for ${mutation.filePath}.`,
            filePath: mutation.filePath,
          }],
        };
      }
    }

    if (!mutation.afterExists) {
      if (mutation.afterContent !== '' || mutation.afterFileHash !== EMPTY_HASH) {
        return {
          ok: false,
          errors: [{
            code: 'INVALID_PREPARED_MUTATION',
            message: `Absent after-state must have empty content and empty hash for ${mutation.filePath}.`,
            filePath: mutation.filePath,
          }],
        };
      }
    }

    if (mutation.type === 'create') {
      if (mutation.beforeExists !== false || mutation.afterExists !== true) {
        return {
          ok: false,
          errors: [{
            code: 'INVALID_PREPARED_MUTATION',
            message: `Create mutation must transition from false to true for ${mutation.filePath}.`,
            filePath: mutation.filePath,
          }],
        };
      }
    } else if (mutation.type === 'replace') {
      if (mutation.beforeExists !== true || mutation.afterExists !== true) {
        return {
          ok: false,
          errors: [{
            code: 'INVALID_PREPARED_MUTATION',
            message: `Replace mutation must transition from true to true for ${mutation.filePath}.`,
            filePath: mutation.filePath,
          }],
        };
      }
    } else if (mutation.type === 'delete') {
      if (mutation.beforeExists !== true || mutation.afterExists !== false) {
        return {
          ok: false,
          errors: [{
            code: 'INVALID_PREPARED_MUTATION',
            message: `Delete mutation must transition from true to false for ${mutation.filePath}.`,
            filePath: mutation.filePath,
          }],
        };
      }
    }
  }

  // 3 & 4. Resolve paths and check canonical collisions
  const resolvedMutations: Array<{
    mutation: PreparedFileMutation;
    resolvedPath: string;
    canonicalPath: string;
    mappedMode: 'create_file' | 'replace_file' | 'delete_file';
  }> = [];

  const seenCanonicalPaths = new Set<string>();

  for (const mutation of mutations) {
    const mappedMode = mutation.type === 'create'
      ? 'create_file'
      : mutation.type === 'replace'
        ? 'replace_file'
        : 'delete_file';

    let resolvedPath: string;
    let canonicalPath: string;
    try {
      const pathResult = enforcePathPolicy(repoRoot, mutation.filePath, mappedMode);
      resolvedPath = pathResult.resolvedPath;
      canonicalPath = pathResult.canonicalPath;
    } catch (error) {
      return {
        ok: false,
        errors: [{
          code: 'INVALID_WORKSPACE_PATH',
          message: 'Workspace path is invalid.',
          filePath: mutation.filePath,
        }],
      };
    }

    if (seenCanonicalPaths.has(canonicalPath)) {
      return {
        ok: false,
        errors: [{
          code: 'CANONICAL_PATH_COLLISION',
          message: `Multiple mutations target the same canonical path: ${mutation.filePath}`,
          filePath: mutation.filePath,
        }],
      };
    }
    seenCanonicalPaths.add(canonicalPath);

    resolvedMutations.push({
      mutation,
      resolvedPath,
      canonicalPath,
      mappedMode,
    });
  }

  // 5 & 6. Read every live target state and check workspace drift before writing anything
  for (const { mutation, resolvedPath } of resolvedMutations) {
    const liveState = readLiveFileState(resolvedPath, mutation.filePath);
    if (!liveState.ok) {
      return {
        ok: false,
        errors: [{
          code: liveState.code,
          message: liveState.message,
          filePath: liveState.filePath,
        }],
      };
    }

    const { exists: liveExists, content: liveContent } = liveState;

    if (liveExists !== mutation.beforeExists) {
      return {
        ok: false,
        errors: [{
          code: 'WORKSPACE_DRIFT',
          message: 'Workspace changed after preview. Preview the changes again.',
          filePath: mutation.filePath,
        }],
      };
    }

    if (liveExists) {
      const liveHash = hashContent(liveContent);
      if (liveHash !== mutation.beforeFileHash || liveContent !== mutation.beforeContent) {
        return {
          ok: false,
          errors: [{
            code: 'WORKSPACE_DRIFT',
            message: 'Workspace changed after preview. Preview the changes again.',
            filePath: mutation.filePath,
          }],
        };
      }
    }
  }

  // Convert prepared mutations to existing execution shape
  const executions: PreflightExecution[] = resolvedMutations.map(({ mutation, resolvedPath, canonicalPath, mappedMode }, index) => {
    const base = {
      operation: {
        type: mappedMode,
        file: mutation.filePath,
        content: mutation.afterExists ? mutation.afterContent : '',
      },
      beforeExists: mutation.beforeExists,
      afterExists: mutation.afterExists,
      beforeContent: mutation.beforeContent,
      afterContent: mutation.afterContent,
      operationIndex: index,
      resolvedPath,
      canonicalPath,
    };

    if (mutation.afterExists) {
      return {
        ...base,
        kind: 'file_content',
        mode: mappedMode as 'create_file' | 'replace_file',
      };
    } else {
      return {
        ...base,
        kind: 'file_delete',
        mode: mappedMode as 'delete_file',
      };
    }
  });

  // Apply and rollback
  const appliedAt = new Date().toISOString();
  const applyId = buildApplyId(appliedAt);
  const historyEntries: HistoryEntry[] = [];

  for (const execution of executions) {
    const restoreEntry = buildRestoreEntry(execution, repoRoot, applyId, appliedAt, {
      protocol: 'v2',
      actionType: 'apply',
    });
    historyEntries.push(restoreEntry);
  }

  try {
    writeExecutions(executions, repoRoot);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const isRollbackFailed = message.includes('Rollback errors:');
    return {
      ok: false,
      errors: [{
        code: isRollbackFailed ? 'ROLLBACK_FAILED' : 'APPLY_WRITE_FAILED',
        message: `Apply write failed: ${message}`,
      }],
    };
  }

  // After successful disk writes, persist history
  try {
    appendHistoryEntries(repoRoot, historyEntries);
  } catch (historyError) {
    const rollbackErrors = rollbackExecutions(executions, repoRoot);
    const historyMessage = historyError instanceof Error ? historyError.message : String(historyError);
    if (rollbackErrors.length > 0) {
      return {
        ok: false,
        errors: [
          {
            code: 'HISTORY_PERSISTENCE_FAILED',
            message: `History persistence failed: ${historyMessage}`,
          },
          {
            code: 'ROLLBACK_FAILED',
            message: `Rollback failed during history failure rollback: ${rollbackErrors.join('\n')}`,
          },
        ],
      };
    }
    return {
      ok: false,
      errors: [{
        code: 'HISTORY_PERSISTENCE_FAILED',
        message: `History persistence failed: ${historyMessage}. Disk writes were rolled back successfully.`,
      }],
    };
  }

  return {
    ok: true,
    appliedFileCount: mutations.length,
    historyEntries,
  };
}
