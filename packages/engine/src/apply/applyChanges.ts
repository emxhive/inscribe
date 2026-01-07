/**
 * Applier for Inscribe
 * Applies changes with backups and supports undo
 */

import { ApplyPlan, ApplyResult } from '@inscribe/shared';
import { getOrCreateScope } from '../repository';
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

    const allowedTypes = new Set(['create', 'replace', 'append', 'range']);
    const validationErrors: string[] = [];

    plan.operations.forEach((operation: any, index: number) => {
      if (!operation || typeof operation !== 'object') {
        validationErrors.push(`Operation ${index} is invalid`);
        return;
      }

      if (!allowedTypes.has(operation.type)) {
        validationErrors.push(`Unsupported operation type: ${String(operation.type)}`);
        return;
      }

      if (typeof operation.file !== 'string' || operation.file.trim().length === 0) {
        validationErrors.push(`Operation ${index} has invalid file path`);
      }

      if (typeof operation.content !== 'string') {
        validationErrors.push(`Operation ${index} has invalid content`);
      }

      if (operation.type === 'range') {
        const directives = operation.directives;
        if (
          !directives ||
          typeof directives.START !== 'string' ||
          directives.START.trim().length === 0 ||
          typeof directives.END !== 'string' ||
          directives.END.trim().length === 0
        ) {
          validationErrors.push('Range operation requires START and END directives');
        }
      }
    });

    if (validationErrors.length > 0) {
      return {
        success: false,
        errors: validationErrors,
      };
    }

    const { backupPath } = createBackup(plan, repoRoot);
    const scopeRoots = getOrCreateScope(repoRoot).scope;

    // Apply all operations
    for (const operation of plan.operations) {
      applyOperation(operation, repoRoot, scopeRoots);
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
