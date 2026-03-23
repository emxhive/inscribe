import { ipcMain } from 'electron';
import {
  applyChanges,
  buildOperationComparison,
  appendHistoryEntries,
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
