import * as fs from 'fs';
import { Operation, RESTORE_DIRECTIVE_EXPECT_CONTENT } from '@inscribe/shared';
import { resolveRangeReplacement } from './resolveRangeReplacement';

/**
 * Apply range replace operation
 */
export function applyRangeReplace(filePath: string, operation: Operation): void {
  const content = fs.readFileSync(filePath, 'utf-8');
  const { prefix, suffix, insert, removed } = resolveRangeReplacement(content, operation);
  const expected = operation.directives?.[RESTORE_DIRECTIVE_EXPECT_CONTENT];
  if (expected !== undefined && removed !== expected) {
    throw new Error('Unsafe to restore: range content has changed since apply.');
  }
  const newContent = prefix + insert + suffix;

  fs.writeFileSync(filePath, newContent);
}
