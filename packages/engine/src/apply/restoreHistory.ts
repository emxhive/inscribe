import * as fs from 'fs';
import {
  HistoryEntry,
  Operation,
  RESTORE_DIRECTIVE_EXPECT_APPEND_AT_END,
  RESTORE_DIRECTIVE_EXPECT_CONTENT,
  RESTORE_DIRECTIVE_REMOVE_APPEND,
} from '@inscribe/shared';
import { resolveRangeReplacement } from './resolveRangeReplacement';
import { resolveAndAssertWithinRepo } from '../paths/resolveAndAssertWithin';
import { getEffectiveIgnoreMatchers } from '../repository';

export function buildRestoreEntry(
  operation: Operation,
  repoRoot: string,
  applyId: string,
  appliedAt: string,
  entryIndex: number
): HistoryEntry {
  const ignoreMatcher = getEffectiveIgnoreMatchers(repoRoot);
  const { resolvedPath } = resolveAndAssertWithinRepo(repoRoot, operation.file, ignoreMatcher);
  const fileExists = fs.existsSync(resolvedPath);
  const existingContent = fileExists ? fs.readFileSync(resolvedPath, 'utf-8') : '';
  const restoreOperation = buildRestoreOperation(operation, existingContent);

  return {
    id: `${applyId}:${entryIndex}`,
    applyId,
    file: operation.file,
    mode: operation.type,
    createdAt: appliedAt,
    restoreOperation,
    blockIndex: operation.blockIndex,
  };
}

function buildRestoreOperation(operation: Operation, existingContent: string): Operation {
  switch (operation.type) {
    case 'create':
      return {
        type: 'delete',
        file: operation.file,
        content: '',
        directives: {
          [RESTORE_DIRECTIVE_EXPECT_CONTENT]: operation.content,
        },
        blockIndex: operation.blockIndex,
      };
    case 'replace':
      return {
        type: 'replace',
        file: operation.file,
        content: existingContent,
        directives: {
          [RESTORE_DIRECTIVE_EXPECT_CONTENT]: operation.content,
        },
        blockIndex: operation.blockIndex,
      };
    case 'append': {
      const appendedContent = operation.content;
      return {
        type: 'append',
        file: operation.file,
        content: appendedContent,
        directives: {
          [RESTORE_DIRECTIVE_REMOVE_APPEND]: 'true',
          [RESTORE_DIRECTIVE_EXPECT_APPEND_AT_END]: appendedContent,
        },
        blockIndex: operation.blockIndex,
      };
    }
    case 'range': {
      const resolved = resolveRangeReplacement(existingContent, operation);
      return {
        type: 'range',
        file: operation.file,
        content: resolved.removed,
        directives: {
          ...(operation.directives ?? {}),
          [RESTORE_DIRECTIVE_EXPECT_CONTENT]: resolved.insert,
        },
        blockIndex: operation.blockIndex,
      };
    }
    case 'delete':
      return {
        type: 'create',
        file: operation.file,
        content: existingContent,
        directives: {},
        blockIndex: operation.blockIndex,
      };
    default:
      throw new Error(`Unknown operation type: ${operation.type}`);
  }
}
