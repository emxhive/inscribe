/**
 * Applier for Inscribe
 * Applies changes with backups and supports undo
 */

import { ApplyPlan, ApplyResult, Operation, ValidationError } from '@inscribe/shared';
import { applyOperation } from './applyOperation';
import { createBackup } from './backups';

const VALID_OPERATION_TYPES = new Set(['create', 'replace', 'append', 'range']);

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
    const startKeys = ['START', 'START_BEFORE', 'START_AFTER'];
    const endKeys = ['END', 'END_BEFORE', 'END_AFTER'];
    const startMatches = startKeys.filter(key => directives[key]);
    const endMatches = endKeys.filter(key => directives[key]);
    if (startMatches.length !== 1 || endMatches.length > 1) {
      errors.push('Range operation requires exactly one of START, START_BEFORE, START_AFTER directives and at most one of END, END_BEFORE, END_AFTER directives');
    }
  }

  return errors;
}

/**
 * Apply changes with backup
 */
export function applyChanges(plan: ApplyPlan, repoRoot: string): ApplyResult {
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
