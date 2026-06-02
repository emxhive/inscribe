import { ipcMain } from 'electron';
import {
  applyChanges,
  buildOperationComparison,
  getAppliedAiInputRecord,
  recordAppliedAiInput,
  restoreEntry,
  type RestoreRequest,
} from '@inscribe/engine';
import type { ApplyPlan, Operation } from '@inscribe/shared';
import { requireTrustedRepoRoot } from './trustedRepo';

/**
 * Register apply IPC handlers
 */
export function registerApplyHandlers() {
  ipcMain.handle('applied-ai-input-get', async (event, rawInput: string, suppliedRepoRoot?: string) => {
    const repoRoot = requireTrustedRepoRoot(event, suppliedRepoRoot);
    return getAppliedAiInputRecord(repoRoot, rawInput);
  });

  ipcMain.handle('apply-changes', async (event, plan: ApplyPlan, suppliedRepoRoot?: string, rawAiInput?: string) => {
    try {
      const repoRoot = requireTrustedRepoRoot(event, suppliedRepoRoot);
      const result = applyChanges(plan, repoRoot);
      if (result.success && rawAiInput && result.historyEntries?.length) {
        try {
          recordAppliedAiInput(repoRoot, rawAiInput, {
            appliedAt: result.historyEntries[0]?.createdAt,
            appliedBlockCount: result.historyEntries.length,
            applyId: result.historyEntries[0]?.applyId,
          });
        } catch (recordError) {
          console.error('Failed to record applied AI input:', recordError);
        }
      }
      return result;
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
