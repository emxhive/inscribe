import { OperationPreview } from '@inscribe/shared';
import { resolveOperationExecution } from '../operation/resolveOperationExecution';

/**
 * Builds a preview shape for a single operation.
 * This is primarily for display and confirmation.
 */
export function buildOperationPreview(operation: any, content: string): OperationPreview {
  const resolved = resolveOperationExecution(operation, { exists: true, content });

  if (resolved.kind === 'partial_replacement') {
    const { replacement } = resolved;
    return {
      type: operation.type,
      file: operation.file,
      content: resolved.afterContent,
      insert: replacement.newText,
      replaceStart: replacement.oldStart,
      replaceEnd: replacement.oldEnd,
      removed: replacement.oldText,
    };
  }

  // Full file operations
  return {
    type: operation.type,
    file: operation.file,
    content: resolved.afterContent,
    insert: resolved.afterContent,
    replaceStart: 0,
    replaceEnd: content.length,
    removed: content,
  };
}
