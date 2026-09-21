import { ipcMain } from 'electron';
import {
  getHistoryEntries,
  previewRestoreAction,
  restoreAction,
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
    'history-preview-restore',
    async (event, suppliedRepoRoot: string | undefined, actionId: string) => {
      const repoRoot = requireTrustedRepoRoot(event, suppliedRepoRoot);
      return previewRestoreAction(actionId, repoRoot);
    },
  );

  ipcMain.handle(
    'history-restore',
    async (event, suppliedRepoRoot: string | undefined, actionId: string) => {
      const repoRoot = requireTrustedRepoRoot(event, suppliedRepoRoot);
      return restoreAction(actionId, repoRoot);
    },
  );
}
