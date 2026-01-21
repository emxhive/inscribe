import * as fs from 'fs';
import type { Operation, OperationPreview } from '@inscribe/shared';
import { resolveAndAssertWithinRepo } from '../paths/resolveAndAssertWithin';
import { getEffectiveIgnoreMatchers } from '../repository';
import { resolveRangeReplacement } from '../apply/resolveRangeReplacement';

export function buildOperationPreview(operation: Operation, repoRoot: string): OperationPreview {
  const ignoreMatcher = getEffectiveIgnoreMatchers(repoRoot);
  const { resolvedPath } = resolveAndAssertWithinRepo(repoRoot, operation.file, ignoreMatcher);
  const content = fs.readFileSync(resolvedPath, 'utf-8');

  if (operation.type === 'append') {
    return {
      type: operation.type,
      file: operation.file,
      content,
      insert: operation.content,
      replaceStart: content.length,
      replaceEnd: content.length,
      removed: '',
    };
  }

  if (operation.type === 'range') {
    const { replaceStart, replaceEnd, insert, removed } = resolveRangeReplacement(content, operation);
    return {
      type: operation.type,
      file: operation.file,
      content,
      insert,
      replaceStart,
      replaceEnd,
      removed,
    };
  }

  throw new Error('Preview is only supported for append and range operations');
}
