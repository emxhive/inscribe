/**
 * Applier for Inscribe
 * Applies changes and generates restore history entries
 */

import * as fs from 'fs';
import * as path from 'path';
import { ApplyPlan, ApplyResult, HistoryEntry, Operation, ValidationError } from '@inscribe/shared';
import { buildRestoreEntry } from './restoreHistory';
import { resolveRangeDirectiveShape } from '../range/resolveRange';
import { cleanupEmptyDirs, PreflightExecution, preflightOperations } from './preflight';

const VALID_OPERATION_TYPES = new Set(['create', 'replace', 'append', 'range', 'delete', 'replace_symbol']);

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
      try {
        resolveRangeDirectiveShape(directives);
      } catch (error) {
        errors.push(error instanceof Error ? error.message : 'Invalid range directives');
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

    const executions = preflightOperations(plan.operations, repoRoot);

    // Apply all operations only after the full plan has resolved and validated.
    const appliedAt = new Date().toISOString();
    const applyId = buildApplyId(appliedAt);
    writeExecutions(executions, repoRoot);

    for (const execution of executions) {
      const restoreEntry = buildRestoreEntry(
        execution.operation,
        repoRoot,
        applyId,
        appliedAt,
        execution.operationIndex,
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

function writeExecutions(executions: PreflightExecution[], repoRoot: string): void {
  const written: PreflightExecution[] = [];

  try {
    for (const execution of executions) {
      writeExecution(execution, repoRoot);
      written.push(execution);
    }
  } catch (error) {
    const rollbackErrors = rollbackExecutions(written, repoRoot);
    if (rollbackErrors.length > 0) {
      const message = error instanceof Error ? error.message : 'Unknown write error';
      throw new Error(`${message}\nRollback errors:\n${rollbackErrors.join('\n')}`);
    }

    throw error;
  }
}

function writeExecution(execution: PreflightExecution, repoRoot: string): void {
  if (execution.afterExists) {
    fs.mkdirSync(path.dirname(execution.resolvedPath), { recursive: true });
    fs.writeFileSync(execution.resolvedPath, execution.afterContent);
    return;
  }

  if (fs.existsSync(execution.resolvedPath)) {
    fs.unlinkSync(execution.resolvedPath);
    cleanupEmptyDirs(execution.resolvedPath, repoRoot);
  }
}

function rollbackExecutions(executions: PreflightExecution[], repoRoot: string): string[] {
  const errors: string[] = [];

  for (const execution of [...executions].reverse()) {
    try {
      if (execution.beforeExists) {
        fs.mkdirSync(path.dirname(execution.resolvedPath), { recursive: true });
        fs.writeFileSync(execution.resolvedPath, execution.beforeContent);
      } else if (fs.existsSync(execution.resolvedPath)) {
        fs.unlinkSync(execution.resolvedPath);
        cleanupEmptyDirs(execution.resolvedPath, repoRoot);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown rollback error';
      errors.push(`${execution.operation.file}: ${message}`);
    }
  }

  return errors;
}
