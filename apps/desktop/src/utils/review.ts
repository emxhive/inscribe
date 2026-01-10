import type { ApplyPlan, ParsedBlock, ValidationError } from '@shared';

import { getLanguageFromFilename } from './language';
import { countLines } from './text';
import type { ReviewItem } from '@desktop/types';

/**
 * Review item construction utilities
 */

/**
 * Build review items from parsed blocks and validation errors
 */
export function buildReviewItems(
  blocks: ParsedBlock[],
  validationErrors: ValidationError[]
): ReviewItem[] {
  // Create a map of blockIndex to validation errors
  const errorMap = new Map<number, ValidationError[]>();
  for (const error of validationErrors) {
    const errors = errorMap.get(error.blockIndex) || [];
    errors.push(error);
    errorMap.set(error.blockIndex, errors);
  }

  return blocks.map((block): ReviewItem => {
    const errors = errorMap.get(block.blockIndex) || [];
    const hasErrors = errors.length > 0;
    const validationError = hasErrors ? errors.map((e) => e.message).join('; ') : undefined;
    const status: ReviewItem['status'] = hasErrors ? 'invalid' : 'pending';

    return {
      id: `${block.blockIndex}-${block.file}`,
      file: block.file,
      mode: block.mode,
      language: getLanguageFromFilename(block.file),
      lineCount: countLines(block.content),
      status,
      originalContent: block.content,
      editedContent: block.content,
      validationError,
      blockIndex: block.blockIndex,
      directives: block.directives,
    };
  });
}

/**
 * Build an apply plan from review items
 */
export function buildApplyPlanFromItems(items: ReviewItem[]): ApplyPlan {
  return {
    operations: items.map((item) => ({
      type: item.mode,
      file: item.file,
      content: item.editedContent,
      directives: item.directives,
    })),
  };
}
