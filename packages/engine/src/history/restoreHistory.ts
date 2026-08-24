import {
  HistoryEntry,
  Operation,
  RESTORE_DIRECTIVE_V2_PAYLOAD,
  RESTORE_DIRECTIVE_V2_SCHEMA,
} from '@inscribe/shared';
import { buildRestorePayload } from './restoreV2';
import type { PreflightExecution } from '../preflight/preflight';

/**
 * Builds a history entry for a resolved execution.
 * Consumes the execution result as the canonical truth of what happened.
 */
export function buildRestoreEntry(
  execution: PreflightExecution,
  repoRoot: string,
  applyId: string,
  appliedAt: string,
  metadata: {
    protocol?: 'v2';
    actionType?: 'apply' | 'restore';
    sourceEntryId?: string;
    sourceActionId?: string;
    modeOverride?: Operation['type'];
  } = {},
): HistoryEntry {
  const { operation, beforeContent, afterContent, operationIndex } = execution;

  const historyOperation = metadata.modeOverride
    ? { ...operation, type: metadata.modeOverride }
    : operation;
  const restorePayload = buildRestorePayload(historyOperation.type, operation.file, beforeContent, afterContent);
  const restoreOperation = buildRestoreOperation(historyOperation, restorePayload);

  return {
    id: `${applyId}:${operationIndex}`,
    applyId,
    actionId: applyId,
    actionType: metadata.actionType ?? 'apply',
    sourceEntryId: metadata.sourceEntryId,
    sourceActionId: metadata.sourceActionId,
    protocol: metadata.protocol,
    file: operation.file,
    mode: historyOperation.type,
    createdAt: appliedAt,
    restoreOperation, // Deprecated compatibility data for persisted history/UI display
    restorePayload,
    blockIndex: operation.blockIndex,
  };
}

function buildRestoreOperation(operation: Operation, payload: ReturnType<typeof buildRestorePayload>): Operation {
  // Kept only for deprecated persisted history compatibility.
  // Active restore execution uses restorePayload through resolveRestoreExecution.
  switch (operation.type) {
    case 'create_file':
      return baseRestore('delete_file', operation, payload, '');
    case 'replace_file':
    case 'append_file':
    case 'replace_line':
    case 'replace_range':
    case 'replace_between':
    case 'replace_block':
    case 'replace_symbol':
      return baseRestore(operation.type, operation, payload, payload.oldContent);
    case 'delete_file':
      return baseRestore('create_file', operation, payload, payload.oldContent);
    default:
      throw new Error(`Unknown operation type: ${operation.type}`);
  }
}

function baseRestore(type: Operation['type'], operation: Operation, payload: ReturnType<typeof buildRestorePayload>, content: string): Operation {
  return {
    type,
    file: operation.file,
    content,
    directives: {
      [RESTORE_DIRECTIVE_V2_SCHEMA]: '2',
      [RESTORE_DIRECTIVE_V2_PAYLOAD]: JSON.stringify(payload),
    },
    blockIndex: operation.blockIndex,
  };
}
