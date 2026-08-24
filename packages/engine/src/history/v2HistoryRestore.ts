import * as fs from 'fs';
import type {
  ApplyResult,
  HistoryEntry,
  Mode,
  V2RestorePreview,
  V2RestorePreviewFile,
} from '@inscribe/shared';
import { appendHistoryEntries, getHistoryEntries } from '../repo/historyStore';
import { enforceRestorePathPolicy } from '../paths/pathPolicy';
import { rollbackExecutions, writeExecutions } from '../apply/writeExecutions';
import { buildRestoreEntry } from './restoreHistory';
import {
  resolveExactV2RestoreExecution,
  type RestoreFileState,
} from './restoreExecution';
import type { PreflightExecution } from '../preflight/preflight';
import { computeDiffHunks } from '../v2/diff';

function isV2Entry(entry: HistoryEntry): boolean {
  return entry.protocol === 'v2';
}

function entryActionId(entry: HistoryEntry): string {
  return entry.actionId ?? entry.applyId;
}

function readCurrentFileState(resolvedPath: string): RestoreFileState {
  if (!fs.existsSync(resolvedPath)) {
    return { exists: false, content: '' };
  }
  return { exists: true, content: fs.readFileSync(resolvedPath, 'utf-8') };
}

function findActionEntries(repoRoot: string, actionId: string): HistoryEntry[] {
  return getHistoryEntries(repoRoot)
    .filter((entry) => isV2Entry(entry) && entryActionId(entry) === actionId)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id));
}

function assertExecutionsStillCurrent(executions: PreflightExecution[]): void {
  for (const execution of executions) {
    const current = readCurrentFileState(execution.resolvedPath);
    if (current.exists !== execution.beforeExists || current.content !== execution.beforeContent) {
      throw new Error(`Workspace changed while preparing V2 restore: ${execution.operation.file}`);
    }
  }
}

function historyModeForExecution(execution: PreflightExecution): Mode {
  if (!execution.afterExists) return 'delete_file';
  if (!execution.beforeExists) return 'create_file';
  return 'replace_file';
}

function resolveAction(
  repoRoot: string,
  actionId: string,
): {
  entries: HistoryEntry[];
  executions: PreflightExecution[];
  files: V2RestorePreviewFile[];
  error?: string;
} {
  const entries = findActionEntries(repoRoot, actionId);
  if (entries.length === 0) {
    return { entries, executions: [], files: [], error: `V2 history action not found: ${actionId}` };
  }

  const executions: PreflightExecution[] = [];
  const files = entries.map((entry, index): V2RestorePreviewFile => {
    const payload = entry.restorePayload;
    if (!payload) {
      return {
        entryId: entry.id,
        file: entry.file,
        mode: entry.mode,
        currentExists: false,
        currentContent: '',
        eligible: false,
        error: 'This historical V2 action has no restore payload and cannot be previewed safely.',
      };
    }

    try {
      const { resolvedPath } = enforceRestorePathPolicy(repoRoot, payload.file, payload.mode);
      const currentFile = readCurrentFileState(resolvedPath);
      const execution = resolveExactV2RestoreExecution(
        { entryId: entry.id, payload },
        currentFile,
        resolvedPath,
        index,
      );
      executions.push(execution);
      return {
        entryId: entry.id,
        sourceEntryId: entry.sourceEntryId,
        file: payload.file,
        mode: payload.mode,
        currentExists: currentFile.exists,
        currentContent: currentFile.content,
        restoredState: {
          exists: execution.afterExists,
          content: execution.afterContent,
        },
        diffHunks: computeDiffHunks(currentFile.content, execution.afterContent),
        eligible: true,
      };
    } catch (error) {
      let currentFile: RestoreFileState = { exists: false, content: '' };
      try {
        const { resolvedPath } = enforceRestorePathPolicy(repoRoot, entry.file, entry.mode);
        currentFile = readCurrentFileState(resolvedPath);
      } catch {
        // The original error is the useful safety explanation.
      }
      return {
        entryId: entry.id,
        sourceEntryId: entry.sourceEntryId,
        file: entry.file,
        mode: entry.mode,
        currentExists: currentFile.exists,
        currentContent: currentFile.content,
        eligible: false,
        error: error instanceof Error ? error.message : 'Historical V2 action is unsafe to restore.',
      };
    }
  });

  return {
    entries,
    executions,
    files,
    error: files.some((file) => !file.eligible)
      ? 'Restore is unavailable because one or more files no longer match a safe reversible state.'
      : undefined,
  };
}

export function previewV2RestoreAction(actionId: string, repoRoot: string): V2RestorePreview {
  const resolved = resolveAction(repoRoot, actionId);
  return {
    actionId,
    actionType: resolved.entries[0]?.actionType,
    createdAt: resolved.entries[0]?.createdAt,
    sourceActionId: resolved.entries[0]?.sourceActionId,
    files: resolved.files,
    eligible: resolved.files.length > 0 && resolved.files.every((file) => file.eligible),
    error: resolved.error,
  };
}

export function restoreV2Action(actionId: string, repoRoot: string): ApplyResult {
  try {
    const resolved = resolveAction(repoRoot, actionId);
    if (resolved.error || resolved.files.length === 0 || resolved.files.some((file) => !file.eligible)) {
      return { success: false, errors: [resolved.error ?? 'V2 restore is not eligible.'] };
    }

    const restoredAt = new Date().toISOString();
    const restoreActionId = `${restoredAt}-${Math.random().toString(36).slice(2, 10)}`;
    const sourceActionId = actionId;
    const historyEntries = resolved.executions.map((execution, index) => {
      const sourceEntry = resolved.entries[index];
      return buildRestoreEntry(execution, repoRoot, restoreActionId, restoredAt, {
        protocol: 'v2',
        actionType: 'restore',
        sourceEntryId: sourceEntry.id,
        sourceActionId,
        modeOverride: historyModeForExecution(execution),
      });
    });

    try {
      assertExecutionsStillCurrent(resolved.executions);
      writeExecutions(resolved.executions, repoRoot);
    } catch (error) {
      return { success: false, errors: [error instanceof Error ? error.message : 'V2 restore write failed.'] };
    }

    try {
      const allHistory = appendHistoryEntries(repoRoot, historyEntries);
      return { success: true, historyEntries: allHistory };
    } catch (error) {
      const rollbackErrors = rollbackExecutions(resolved.executions, repoRoot);
      const message = error instanceof Error ? error.message : 'V2 history persistence failed.';
      return {
        success: false,
        errors: [
          `V2 history persistence failed: ${message}`,
          ...(rollbackErrors.length ? [`V2 restore rollback failed: ${rollbackErrors.join('\n')}`] : []),
        ],
      };
    }
  } catch (error) {
    return { success: false, errors: [error instanceof Error ? error.message : 'V2 restore failed.'] };
  }
}
