import { ipcMain } from 'electron';
import {
  getOrCreateScope,
  listTopLevelFolders,
  computeSuggestedExcludes,
  setScopeState,
  readIgnoreRules,
  indexRepository,
  getIndexStatus,
} from '@engine';

/**
 * Register repository-related IPC handlers
 */
export function registerRepositoryHandlers() {
  ipcMain.handle('repo-init', async (_event, repoRoot: string) => {
    try {
      const scopeState = getOrCreateScope(repoRoot);
      const topLevelFolders = listTopLevelFolders(repoRoot);
      const suggested = computeSuggestedExcludes(repoRoot);
      setScopeState(repoRoot, scopeState.scope, { lastSuggested: suggested });
      const ignore = readIgnoreRules(repoRoot);
      const indexedFiles = indexRepository(repoRoot);

      return {
        topLevelFolders,
        scope: scopeState.scope,
        ignore,
        suggested,
        indexedCount: indexedFiles.length,
        indexStatus: getIndexStatus(repoRoot),
      };
    } catch (error) {
      return {
        topLevelFolders: [],
        scope: [],
        ignore: { entries: [], source: 'none', path: '' },
        suggested: [],
        indexedCount: 0,
        indexStatus: {
          state: 'error',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  });

  ipcMain.handle('index-repository', async (_event, repoRoot: string) => {
    try {
      return indexRepository(repoRoot);
    } catch (error) {
      console.error('Error indexing repository:', error);
      return [];
    }
  });

  ipcMain.handle('index-status', async (_event, repoRoot: string) => {
    return getIndexStatus(repoRoot);
  });
}
