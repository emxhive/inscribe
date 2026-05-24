import * as fs from 'fs';
import type { ApplyResult, OperationMode } from '@inscribe/shared';
import { writeExecutions } from '../apply/writeExecutions';
import { enforceRestorePathPolicy } from '../paths/pathPolicy';
import { getEffectiveIgnoreMatchers } from '../repo/ignoreRules';
import { getHistoryEntries, markHistoryEntryRestoredAndGetEntries } from '../repo/historyStore';
import { getScopeState } from '../repo/scopeStore';
import { resolveRestoreExecution, type RestoreFileState, type RestoreRequest } from './restoreExecution';

export function restoreEntry(request: RestoreRequest, repoRoot: string): ApplyResult {
  try {
    if (!request || !request.payload) {
      return {
        success: false,
        errors: ['Restore request requires a payload'],
      };
    }

    const existingEntry = getHistoryEntries(repoRoot).find((entry) => entry.id === request.entryId);
    if (!existingEntry) {
      return {
        success: false,
        errors: [`History entry not found: ${request.entryId}`],
      };
    }

    if (existingEntry.restoredAt) {
      return {
        success: false,
        errors: [`History entry already restored: ${request.entryId}`],
      };
    }

    const ignoreMatcher = getEffectiveIgnoreMatchers(repoRoot);
    const scopeRoots = getScopeState(repoRoot)?.scope ?? [];
    const { resolvedPath } = enforceRestorePathPolicy(
      repoRoot,
      request.payload.file,
      request.payload.mode as OperationMode,
      scopeRoots,
      ignoreMatcher
    );
    const currentFile = readCurrentFileState(resolvedPath);
    const execution = resolveRestoreExecution(request, currentFile, resolvedPath, 0);

    writeExecutions([execution], repoRoot);

    const restoredAt = new Date().toISOString();
    const marked = markHistoryEntryRestoredAndGetEntries(repoRoot, request.entryId, restoredAt);
    if (!marked.didUpdate) {
      return {
        success: false,
        errors: [`History entry not found: ${request.entryId}`],
      };
    }

    return {
      success: true,
      historyEntries: marked.entries,
    };
  } catch (error) {
    return {
      success: false,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
}

function readCurrentFileState(resolvedPath: string): RestoreFileState {
  if (!fs.existsSync(resolvedPath)) {
    return {
      exists: false,
      content: '',
    };
  }

  return {
    exists: true,
    content: fs.readFileSync(resolvedPath, 'utf-8'),
  };
}
