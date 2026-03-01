/**
 * Applier for Inscribe
 * Applies changes and generates restore history entries
 */

import { ApplyPlan, ApplyResult, HistoryEntry, Operation, ValidationError } from '@inscribe/shared';
import { applyOperation } from './applyOperation';
import { buildRestoreEntry } from './restoreHistory';

const VALID_OPERATION_TYPES = new Set(['create', 'replace', 'append', 'range', 'delete']);

function validateOperation(operation: Operation, index: number): string[] {
  const errors: string[] = [];

  if (!operation || typeof operation !== 'object') {
    return [`Operation ${index} is invalid`];
  }

  if (!VALID_OPERATION_TYPES.has(operation.type)) {
    errors.push(`Unknown operation type: ${String(operation.type)}`);
  }

  if (operation.file.trim().length === 0) {
    errors.push(`Operation ${index} requires a non-empty file path`);
  }



  if (operation.type === 'range') {
    const directives = operation.directives || {};
    if (directives.RESTORE_V2_SCHEMA !== '2') {
      const startKeys = ['START', 'START_BEFORE', 'START_AFTER'];
      const endKeys = ['END', 'END_BEFORE', 'END_AFTER'];
      const startMatches = startKeys.filter(key => directives[key]);
      const endMatches = endKeys.filter(key => directives[key]);
      if (startMatches.length !== 1 || endMatches.length > 1) {
        errors.push('Range operation requires exactly one of START, START_BEFORE, START_AFTER directives and at most one of END, END_BEFORE, END_AFTER directives');
      }
    }
  }

  return errors;
}

/**
 * Apply changes and emit restore history entries
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

    // Apply all operations
    const appliedAt = new Date().toISOString();
    const applyId = buildApplyId(appliedAt);
    for (const [index, operation] of plan.operations.entries()) {
      const execution = applyOperation(operation, repoRoot);
      const restoreEntry = buildRestoreEntry(
        operation,
        repoRoot,
        applyId,
        appliedAt,
        index,
        execution.beforeContent,
        execution.afterContent
      );
      historyEntries.push(restoreEntry);
    }

    return {
      success: true,
      historyEntries,
    };
  } catch (error) {
    return {
      success: false,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
      historyEntries,
    };
  }
}

function buildApplyId(timestamp: string): string {
  return `${timestamp}-${Math.random().toString(36).slice(2, 10)}`;
}
