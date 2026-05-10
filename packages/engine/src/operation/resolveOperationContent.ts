import { Operation } from '@inscribe/shared';
import { resolveRangeReplacement } from '../apply/resolveRangeReplacement';
import { resolveStructuralAdapter } from '../language/registry';

export interface OperationResolvedContent {
  afterContent: string;
  replacement?: {
    oldStart: number;
    oldEnd: number;
    newStart: number;
    newEnd: number;
    oldText: string;
    newText: string;
  };
}

export function resolveOperationContent(operation: Operation, beforeContent: string): OperationResolvedContent {
  switch (operation.type) {
    case 'create': {
      return {
        afterContent: operation.content,
        replacement: {
          oldStart: 0,
          oldEnd: 0,
          newStart: 0,
          newEnd: operation.content.length,
          oldText: '',
          newText: operation.content,
        },
      };
    }
    case 'replace': {
      return {
        afterContent: operation.content,
      };
    }
    case 'append': {
      const afterContent = `${beforeContent}${operation.content}`;
      return {
        afterContent,
        replacement: {
          oldStart: beforeContent.length,
          oldEnd: beforeContent.length,
          newStart: beforeContent.length,
          newEnd: afterContent.length,
          oldText: '',
          newText: operation.content,
        },
      };
    }
    case 'range': {
      const { prefix, suffix, insert, replaceStart, replaceEnd, removed } = resolveRangeReplacement(beforeContent, operation);
      const afterContent = `${prefix}${insert}${suffix}`;
      return {
        afterContent,
        replacement: {
          oldStart: replaceStart,
          oldEnd: replaceEnd,
          newStart: prefix.length,
          newEnd: prefix.length + insert.length,
          oldText: removed,
          newText: insert,
        },
      };
    }
    case 'replace_symbol': {
      const name = operation.directives?.NAME;
      if (!name) throw new Error('replace_symbol requires NAME directive');
      const adapter = resolveStructuralAdapter(operation.file);
      const range = adapter.resolveSymbolDeclarationRange(beforeContent, name);
      const afterContent = `${beforeContent.slice(0, range.start)}${operation.content}${beforeContent.slice(range.end)}`;
      return {
        afterContent,
        replacement: {
          oldStart: range.start,
          oldEnd: range.end,
          newStart: range.start,
          newEnd: range.start + operation.content.length,
          oldText: beforeContent.slice(range.start, range.end),
          newText: operation.content,
        },
      };
    }
    case 'delete': {
      return {
        afterContent: '',
      };
    }
    default:
      throw new Error(`Unknown operation type: ${operation.type}`);
  }
}
