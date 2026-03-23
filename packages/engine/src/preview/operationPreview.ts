import type { Operation, OperationPreview } from '@inscribe/shared';
import { buildOperationComparison } from './operationComparison';

/**
 * Legacy single-region preview shape. It now derives from the canonical
 * comparison model for all currently-supported single-operation review modes.
 */
export function buildOperationPreview(operation: Operation, repoRoot: string): OperationPreview {
  const comparison = buildOperationComparison(operation, repoRoot);
  const region = comparison.regions[0];

  if (!region) {
    return {
      type: operation.type,
      file: operation.file,
      content: comparison.oldContent,
      insert: '',
      replaceStart: 0,
      replaceEnd: 0,
      removed: '',
    };
  }

  return {
    type: operation.type,
    file: operation.file,
    content: comparison.oldContent,
    insert: region.newText,
    replaceStart: region.oldRange.start,
    replaceEnd: region.oldRange.end,
    removed: region.oldText,
  };
}
