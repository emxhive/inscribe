import { ipcMain } from 'electron';
import {
  applyChanges,
  buildOperationPreview,
} from '@inscribe/engine';
import type { ApplyPlan, Operation } from '@inscribe/shared';

/**
 * Register apply IPC handlers
 */
export function registerApplyHandlers() {
  ipcMain.handle('apply-changes', async (_event, plan: ApplyPlan, repoRoot: string) => {
    try {
      return applyChanges(plan, repoRoot);
    } catch (error) {
      return {
        success: false,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  });

  ipcMain.handle('preview-operation', async (_event, operation: Operation, repoRoot: string) => {
    try {
      return buildOperationPreview(operation, repoRoot);
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

}
