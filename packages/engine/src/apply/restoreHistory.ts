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
