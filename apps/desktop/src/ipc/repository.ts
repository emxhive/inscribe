import { ipcMain } from 'electron';
import {
  getOrCreateScope,
  getLastVisitedRepo,
  listTopLevelFolders,
  computeSuggestedExcludes,
  setScopeState,
  readIgnoreRules,
  indexRepository,
  getIndexStatus,
} from '@inscribe/engine';
import { recentProjectsManager } from '../recentProjects';
import { requireTrustedRepoRoot } from './trustedRepo';

/**
 * Register repository-related IPC handlers
 */
export function registerRepositoryHandlers() {
  ipcMain.handle('repo-last-visited', async () => {
    return getLastVisitedRepo();
  });

  ipcMain.handle('repo-init', async (event, suppliedRepoRoot?: string) => {
    try {
      const repoRoot = requireTrustedRepoRoot(event, suppliedRepoRoot);
      const scopeState = getOrCreateScope(repoRoot);
      const topLevelFolders = listTopLevelFolders(repoRoot);
      const suggested = computeSuggestedExcludes(repoRoot);
      setScopeState(repoRoot, scopeState.scope, { lastSuggested: suggested });
      const ignore = readIgnoreRules(repoRoot);
      const indexedFiles = indexRepository(repoRoot);

      // Successfully initialized, add to recent projects
      recentProjectsManager.addProject(repoRoot);

      return {
        topLevelFolders,
        scope: scopeState.scope,
        ignore,
        suggested,
        indexedFiles,
        indexedCount: indexedFiles.length,
        indexStatus: getIndexStatus(repoRoot),
      };
    } catch (error) {
      return {
        topLevelFolders: [],
        scope: [],
        ignore: { entries: [], source: 'none', path: '' },
        suggested: [],
        indexedFiles: [],
        indexedCount: 0,
        indexStatus: {
          state: 'error',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  });

  ipcMain.handle('index-repository', async (event, suppliedRepoRoot?: string) => {
    const repoRoot = requireTrustedRepoRoot(event, suppliedRepoRoot);
    try {
      return indexRepository(repoRoot);
    } catch (error) {
      console.error('Error indexing repository:', error);
      return [];
    }
  });

  ipcMain.handle('index-status', async (event, suppliedRepoRoot?: string) => {
    const repoRoot = requireTrustedRepoRoot(event, suppliedRepoRoot);
    return getIndexStatus(repoRoot);
  });
}
