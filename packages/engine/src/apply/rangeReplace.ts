import * as fs from 'fs';
import { Operation } from '@inscribe/shared';
import { resolveRangeReplacement } from './resolveRangeReplacement';

/**
 * Apply range replace operation
 */
export function applyRangeReplace(filePath: string, operation: Operation): void {
  const content = fs.readFileSync(filePath, 'utf-8');
  const { prefix, suffix, insert } = resolveRangeReplacement(content, operation);
  const newContent = prefix + insert + suffix;

  fs.writeFileSync(filePath, newContent);
}
