import { ipcMain } from 'electron';
import {
  applyChanges,
  buildOperationComparison,
  restoreEntry,
  type RestoreRequest,
} from '@inscribe/engine';
import type { ApplyPlan, Operation } from '@inscribe/shared';
import { requireTrustedRepoRoot } from './trustedRepo';

/**
 * Register apply IPC handlers
 */
export function registerApplyHandlers() {
  ipcMain.handle('apply-changes', async (event, plan: ApplyPlan, suppliedRepoRoot?: string) => {
    try {
      const repoRoot = requireTrustedRepoRoot(event, suppliedRepoRoot);
      return applyChanges(plan, repoRoot);
    } catch (error) {
      return {
        success: false,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  });

  ipcMain.handle('restore-entry', async (event, request: RestoreRequest, suppliedRepoRoot?: string) => {
    try {
      const repoRoot = requireTrustedRepoRoot(event, suppliedRepoRoot);
      return restoreEntry(request, repoRoot);
    } catch (error) {
      return {
        success: false,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  });

  ipcMain.handle('compare-operation', async (event, operation: Operation, suppliedRepoRoot?: string) => {
    try {
      const repoRoot = requireTrustedRepoRoot(event, suppliedRepoRoot);
      return buildOperationComparison(operation, repoRoot);
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

}
