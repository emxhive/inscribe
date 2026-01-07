import { ipcMain } from 'electron';
import {
  getOrCreateScope,
  setScopeState,
  indexRepository,
  getIndexStatus,
} from '@inscribe/engine';

/**
 * Register scope-related IPC handlers
 */
export function registerScopeHandlers() {
  ipcMain.handle('get-scope', async (_event, repoRoot: string) => {
    try {
      return getOrCreateScope(repoRoot).scope;
    } catch {
      return [];
    }
  });

  ipcMain.handle('set-scope', async (_event, repoRoot: string, scope: string[]) => {
    try {
      const updated = setScopeState(repoRoot, scope);
      const indexedFiles = indexRepository(repoRoot, updated.scope);
      return {
        scope: updated.scope,
        indexedCount: indexedFiles.length,
        indexStatus: getIndexStatus(repoRoot),
      };
    } catch (error) {
      return {
        scope: [],
        indexedCount: 0,
        indexStatus: {
          state: 'error',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  });
}
