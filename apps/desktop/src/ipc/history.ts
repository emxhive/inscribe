import { ipcMain } from 'electron';
import { getHistoryEntries, markHistoryEntryRestored } from '@inscribe/engine';

/**
 * Register history-related IPC handlers
 */
export function registerHistoryHandlers() {
  ipcMain.handle('history-get', async (_event, repoRoot: string) => {
    return getHistoryEntries(repoRoot);
  });

  ipcMain.handle(
    'history-mark-restored',
    async (_event, repoRoot: string, entryId: string, restoredAt: string) => {
      return markHistoryEntryRestored(repoRoot, entryId, restoredAt);
    }
  );
}
