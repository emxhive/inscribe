import { Operation } from '@inscribe/shared';
import { resolveOperationExecution } from './resolveOperationExecution';

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
  const resolved = resolveOperationExecution(operation, { exists: true, content: beforeContent });
  return {
    afterContent: resolved.afterContent,
    replacement: resolved.kind === 'partial_replacement' ? resolved.replacement : undefined,
  };
}
