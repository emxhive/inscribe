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
      const restoreDirectives = buildRangeRestoreDirectives(
        operation.directives ?? {},
        resolved.prefix,
        resolved.suffix,
        resolved.insert
      );
      return {
        type: 'range',
        file: operation.file,
        content: resolved.removed,
        directives: {
          ...restoreDirectives,
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

function buildRangeRestoreDirectives(
  directives: Record<string, string>,
  prefix: string,
  suffix: string,
  inserted: string
): Record<string, string> {
  const scopedDirectives: Record<string, string> = {};
  if (directives.SCOPE_START && directives.SCOPE_END) {
    scopedDirectives.SCOPE_START = directives.SCOPE_START;
    scopedDirectives.SCOPE_END = directives.SCOPE_END;
  }

  const boundaryStart = getLastAnchorLine(prefix);
  const boundaryEnd = getFirstAnchorLine(suffix);
  const insertFirst = getFirstAnchorLine(inserted);
  const insertLast = getLastAnchorLine(inserted);

  if (boundaryStart && boundaryEnd) {
    return {
      ...scopedDirectives,
      START_AFTER: boundaryStart,
      END_BEFORE: boundaryEnd,
    };
  }

  if (boundaryStart && insertLast) {
    return {
      ...scopedDirectives,
      START_AFTER: boundaryStart,
      END: insertLast,
    };
  }

  if (boundaryEnd && insertFirst) {
    return {
      ...scopedDirectives,
      START: insertFirst,
      END_BEFORE: boundaryEnd,
    };
  }

  if (insertFirst && insertLast && insertFirst !== insertLast) {
    return {
      ...scopedDirectives,
      START: insertFirst,
      END: insertLast,
    };
  }

  if (insertFirst) {
    return {
      ...scopedDirectives,
      START: insertFirst,
    };
  }

  return { ...scopedDirectives, ...directives };
}

function getFirstAnchorLine(text: string): string | null {
  const lines = text.split('\n');
  for (const line of lines) {
    if (line.trim().length > 0) {
      return line;
    }
  }
  return null;
}

function getLastAnchorLine(text: string): string | null {
  const lines = text.split('\n');
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];
    if (line.trim().length > 0) {
      return line;
    }
  }
  return null;
}
