import { ipcMain } from 'electron';
import {
  getOrCreateScope,
  setScopeState,
  indexRepository,
  getIndexStatus,
} from '@inscribe/engine';
import { requireTrustedRepoRoot } from './trustedRepo';

/**
 * Register scope-related IPC handlers
  */
export function registerScopeHandlers() {
  ipcMain.handle('get-scope', async (event, suppliedRepoRoot?: string) => {
    const repoRoot = requireTrustedRepoRoot(event, suppliedRepoRoot);
    try {
      return getOrCreateScope(repoRoot).scope;
    } catch {
      return [];
    }
  });

  ipcMain.handle('set-scope', async (event, suppliedRepoRoot: string | undefined, scope: string[]) => {
    try {
      const repoRoot = requireTrustedRepoRoot(event, suppliedRepoRoot);
      const updated = setScopeState(repoRoot, scope);
      const indexedFiles = indexRepository(repoRoot, updated.scope);
      return {
        scope: updated.scope,
        indexedFiles,
        indexedCount: indexedFiles.length,
        indexStatus: getIndexStatus(repoRoot),
      };
    } catch (error) {
      return {
        scope: [],
        indexedFiles: [],
        indexedCount: 0,
        indexStatus: {
          state: 'error',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  });
}
