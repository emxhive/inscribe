import * as fs from 'fs';
import type { ApplyResult, OperationMode, RestorePayloadV2 } from '@inscribe/shared';
import { writeExecutions } from '../apply/writeExecutions';
import { enforceRestorePathPolicy } from '../paths/pathPolicy';
import { getEffectiveIgnoreMatchers } from '../repo/ignoreRules';
import { getHistoryEntries, markHistoryEntryRestoredAndGetEntries } from '../repo/historyStore';
import { getScopeState } from '../repo/scopeStore';
import { resolveRestoreExecution, type RestoreFileState, type RestoreRequest } from './restoreExecution';

export function restoreEntry(request: RestoreRequest, repoRoot: string): ApplyResult {
  try {
    if (!request || !request.entryId) {
      return {
        success: false,
        errors: ['Restore request requires an entryId'],
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

    if (!existingEntry.restorePayload) {
      return {
        success: false,
        errors: [`History entry is missing restore payload: ${request.entryId}`],
      };
    }

    if (request.payload && !payloadsEqual(request.payload, existingEntry.restorePayload)) {
      return {
        success: false,
        errors: [`Restore payload mismatch for history entry: ${request.entryId}`],
      };
    }

    const trustedPayload = existingEntry.restorePayload;
    const ignoreMatcher = getEffectiveIgnoreMatchers(repoRoot);
    const scopeRoots = getScopeState(repoRoot)?.scope ?? [];
    const { resolvedPath } = enforceRestorePathPolicy(
      repoRoot,
      trustedPayload.file,
      trustedPayload.mode as OperationMode,
      scopeRoots,
      ignoreMatcher
    );
    const currentFile = readCurrentFileState(resolvedPath);
    const execution = resolveRestoreExecution(
      { entryId: request.entryId, payload: trustedPayload },
      currentFile,
      resolvedPath,
      0
    );

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

function payloadsEqual(left: RestorePayloadV2, right: RestorePayloadV2): boolean {
  return stableStringify(left) === stableStringify(right);
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
}
