import {
  HistoryEntry,
  Operation,
  RESTORE_DIRECTIVE_V2_PAYLOAD,
  RESTORE_DIRECTIVE_V2_SCHEMA,
} from '@inscribe/shared';
import { resolveAndAssertWithinRepo } from '../paths/resolveAndAssertWithin';
import { getEffectiveIgnoreMatchers } from '../repository';
import { buildRestorePayload } from './restoreV2';

export function buildRestoreEntry(
  operation: Operation,
  repoRoot: string,
  applyId: string,
  appliedAt: string,
  entryIndex: number,
  beforeContent: string,
  afterContent: string
): HistoryEntry {
  const ignoreMatcher = getEffectiveIgnoreMatchers(repoRoot);
  resolveAndAssertWithinRepo(repoRoot, operation.file, ignoreMatcher);

  const restorePayload = buildRestorePayload(operation.type, operation.file, beforeContent, afterContent);
  const restoreOperation = buildRestoreOperation(operation, restorePayload);

  return {
    id: `${applyId}:${entryIndex}`,
    applyId,
    file: operation.file,
    mode: operation.type,
    createdAt: appliedAt,
    restoreOperation,
    restorePayload,
    blockIndex: operation.blockIndex,
  };
}

function buildRestoreOperation(operation: Operation, payload: ReturnType<typeof buildRestorePayload>): Operation {
  switch (operation.type) {
    case 'create':
      return {
        type: 'delete',
        file: operation.file,
        content: '',
        directives: {
          [RESTORE_DIRECTIVE_V2_SCHEMA]: '2',
          [RESTORE_DIRECTIVE_V2_PAYLOAD]: JSON.stringify(payload),
        },
        blockIndex: operation.blockIndex,
      };
    case 'replace':
    case 'append':
    case 'range':
      return {
        type: operation.type,
        file: operation.file,
        content: payload.oldContent,
        directives: {
          [RESTORE_DIRECTIVE_V2_SCHEMA]: '2',
          [RESTORE_DIRECTIVE_V2_PAYLOAD]: JSON.stringify(payload),
        },
        blockIndex: operation.blockIndex,
      };
    case 'delete':
      return {
        type: 'create',
        file: operation.file,
        content: payload.oldContent,
        directives: {
          [RESTORE_DIRECTIVE_V2_SCHEMA]: '2',
          [RESTORE_DIRECTIVE_V2_PAYLOAD]: JSON.stringify(payload),
        },
        blockIndex: operation.blockIndex,
      };
    default:
      throw new Error(`Unknown operation type: ${operation.type}`);
  }
}
