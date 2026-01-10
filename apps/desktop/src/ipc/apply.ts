import { ipcMain } from 'electron';
import {
  applyChanges,
  undoLastApply,
} from '@engine';
import type { ApplyPlan } from '@shared';

/**
 * Register apply/undo IPC handlers
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

  ipcMain.handle('undo-last-apply', async (_event, repoRoot: string) => {
    try {
      return undoLastApply(repoRoot);
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });
}
