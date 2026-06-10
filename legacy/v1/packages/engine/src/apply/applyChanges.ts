/**
 * Applier for Inscribe
 * Applies already-resolved preflight executions.
 */

import { ApplyPlan, ApplyResult, HistoryEntry, Operation, ValidationError } from '@inscribe/shared';
import { buildRestoreEntry } from '../history/restoreHistory';
import { preflightOperations } from '../preflight/preflight';
import { appendHistoryEntries } from '../repo/historyStore';
import { rollbackExecutions, writeExecutions } from './writeExecutions';

function validateOperation(operation: Operation, index: number): string[] {
  const errors: string[] = [];

  if (!operation || typeof operation !== 'object') {
    return [`Operation ${index} is invalid`];
  }

  if (typeof operation.type !== 'string' || operation.type.trim().length === 0) {
    errors.push(`Operation ${index} requires a non-empty type`);
  }

  if (typeof operation.file !== 'string' || operation.file.trim().length === 0) {
    errors.push(`Operation ${index} requires a non-empty file path`);
  }

  return errors;
}

/**
 * Apply changes and emit restore history entries.
 * Consumes a plan, runs preflight to resolve executions, then persists results.
 */
export function applyChanges(plan: ApplyPlan, repoRoot: string): ApplyResult {
  const historyEntries: HistoryEntry[] = [];
  try {
    if (plan.errors && plan.errors.length > 0) {
      return {
        success: false,
        errors: plan.errors.map((error: ValidationError) => error.message),
      };
    }

    if (!plan.operations || plan.operations.length === 0) {
      return {
        success: false,
        errors: ['No operations to apply'],
      };
    }

    const operationErrors = plan.operations.flatMap((operation, index) =>
      validateOperation(operation, index)
    );
    if (operationErrors.length > 0) {
      return {
        success: false,
        errors: operationErrors,
      };
    }

    // Preflight resolves all operations into deterministic execution results.
    const executions = preflightOperations(plan.operations, repoRoot);

    // Apply all operations only after the full plan has resolved and validated.
    const appliedAt = new Date().toISOString();
    const applyId = buildApplyId(appliedAt);
    for (const execution of executions) {
      const restoreEntry = buildRestoreEntry(
        execution,
        repoRoot,
        applyId,
        appliedAt,
      );
      historyEntries.push(restoreEntry);
    }

    writeExecutions(executions, repoRoot);

    try {
      appendHistoryEntries(repoRoot, historyEntries);
    } catch (historyError) {
      const rollbackErrors = rollbackExecutions(executions, repoRoot);
      const historyMessage = historyError instanceof Error ? historyError.message : 'Unknown history persistence error';
      if (rollbackErrors.length > 0) {
        return {
          success: false,
          errors: [
            `History persistence failed after disk writes: ${historyMessage}`,
            `Rollback failed: ${rollbackErrors.join('; ')}`,
          ],
        };
      }

      return {
        success: false,
        errors: [
          `History persistence failed after disk writes: ${historyMessage}`,
          'Disk writes were rolled back.',
        ],
      };
    }

    return {
      success: true,
      historyEntries,
    };
  } catch (error) {
    return {
      success: false,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
}

function buildApplyId(timestamp: string): string {
  return `${timestamp}-${Math.random().toString(36).slice(2, 10)}`;
}

