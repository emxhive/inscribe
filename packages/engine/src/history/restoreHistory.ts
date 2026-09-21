import {
  HistoryEntry,
  Operation,
} from '@inscribe/shared';
import { buildRestorePayload } from './restoreV2';
import type { PreflightExecution } from '../apply/executionTypes';

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
    restorePayload,
    blockIndex: operation.blockIndex,
  };
}
