/**
 * Planner for Inscribe
 * Builds deterministic apply plans from validated blocks
 */

import { ParsedBlock, ApplyPlan, Operation } from '@inscribe/shared';

/**
 * Build an applied plan from validated blocks.
 * Assumes blocks have already been validated; repo-agnostic.
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
