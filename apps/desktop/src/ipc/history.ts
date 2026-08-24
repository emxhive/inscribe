import { ipcMain } from 'electron';
import {
  getHistoryEntries,
  markHistoryEntryRestored,
  previewV2RestoreAction,
  restoreV2Action,
} from '@inscribe/engine';
import { requireTrustedRepoRoot } from './trustedRepo';

/**
 * Register history-related IPC handlers
 */
export function registerHistoryHandlers() {
  ipcMain.handle('history-get', async (event, suppliedRepoRoot?: string) => {
    const repoRoot = requireTrustedRepoRoot(event, suppliedRepoRoot);
    return getHistoryEntries(repoRoot);
  });

  ipcMain.handle(
    'history-mark-restored',
    async (event, suppliedRepoRoot: string | undefined, entryId: string, restoredAt: string) => {
      const repoRoot = requireTrustedRepoRoot(event, suppliedRepoRoot);
      return markHistoryEntryRestored(repoRoot, entryId, restoredAt);
    }
  );

  ipcMain.handle(
    'history-v2-preview-restore',
    async (event, suppliedRepoRoot: string | undefined, actionId: string) => {
      const repoRoot = requireTrustedRepoRoot(event, suppliedRepoRoot);
      return previewV2RestoreAction(actionId, repoRoot);
    },
  );

  ipcMain.handle(
    'history-v2-restore',
    async (event, suppliedRepoRoot: string | undefined, actionId: string) => {
      const repoRoot = requireTrustedRepoRoot(event, suppliedRepoRoot);
      return restoreV2Action(actionId, repoRoot);
    },
  );
}
