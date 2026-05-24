import { ipcMain } from 'electron';
import * as fs from 'fs';
import {
  applyChanges,
  buildOperationComparison,
  appendHistoryEntries,
  resolveRestoreExecution,
  type RestoreRequest,
} from '@inscribe/engine';
import type { ApplyPlan, Operation } from '@inscribe/shared';

/**
 * Register apply IPC handlers
 */
export function registerApplyHandlers() {
  ipcMain.handle('apply-changes', async (_event, plan: ApplyPlan, repoRoot: string) => {
    try {
      const result = applyChanges(plan, repoRoot);
      if (result.historyEntries?.length) {
        appendHistoryEntries(repoRoot, result.historyEntries);
      }
      return result;
    } catch (error) {
      return {
        success: false,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  });

  ipcMain.handle('restore-entry', async (_event, request: RestoreRequest, repoRoot: string) => {
    try {
      // Internal restore flow:
      // 1. Resolve current file state
      const filePath = fs.realpathSync(`${repoRoot}/${request.payload.file}`);
      const content = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : '';

      // 2. Resolve restore execution
      const execution = resolveRestoreExecution(request, content, filePath, 0);

      // 3. Persist using apply logic (internal plan)
      const plan: ApplyPlan = { operations: [execution.operation] };
      const result = applyChanges(plan, repoRoot);

      return result;
    } catch (error) {
      return {
        success: false,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  });

  ipcMain.handle('compare-operation', async (_event, operation: Operation, repoRoot: string) => {
    try {
      return buildOperationComparison(operation, repoRoot);
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

}
