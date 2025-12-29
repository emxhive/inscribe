/**
 * Planner for Inscribe
 * Builds deterministic apply plans from validated blocks
 */

import { ParsedBlock, ApplyPlan, Operation } from '@inscribe/shared';

/**
 * Build an apply plan from validated blocks
 */
export function buildApplyPlan(blocks: ParsedBlock[]): ApplyPlan {
  const operations: Operation[] = blocks.map(block => ({
    type: block.mode,
    file: block.file,
    content: block.content,
    directives: block.directives,
  }));

  return {
    operations,
  };
}
