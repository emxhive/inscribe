/**
 * Applier for Inscribe
 * Applies changes with backups and supports undo
 */

import { ApplyPlan, ApplyResult } from '@inscribe/shared';
import { applyOperation } from './applyOperation';
import { createBackup } from './backups';

/**
 * Apply changes with backup
 */
export function applyChanges(plan: ApplyPlan, repoRoot: string): ApplyResult {
  try {
    if (plan.errors && plan.errors.length > 0) {
      return {
        success: false,
        errors: plan.errors.map((error: any) => error.message),
      };
    }

    if (!plan.operations || plan.operations.length === 0) {
      return {
        success: false,
        errors: ['No operations to apply'],
      };
    }

    const { backupPath } = createBackup(plan, repoRoot);

    // Apply all operations
    for (const operation of plan.operations) {
      applyOperation(operation, repoRoot);
    }

    return {
      success: true,
      backupPath,
    };
  } catch (error) {
    return {
      success: false,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
}
