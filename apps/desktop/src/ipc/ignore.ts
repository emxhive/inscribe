import { ipcMain } from 'electron';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import {
  readIgnoreRules,
  writeIgnoreFile,
  computeSuggestedExcludes,
  computeDefaultScope,
  getOrCreateScope,
  setScopeState,
  indexRepository,
  getIndexStatus,
} from '@inscribe/engine';

/**
 * Register ignore-related IPC handlers
 */
export function registerIgnoreHandlers() {
  ipcMain.handle('read-ignore', async (_event, repoRoot: string) => {
    try {
      return readIgnoreRules(repoRoot);
    } catch {
      return { entries: [], source: 'none', path: '' };
    }
  });

  ipcMain.handle('read-ignore-raw', async (_event, repoRoot: string) => {
    try {
      const ignorePath = join(repoRoot, '.inscribeignore');
      
      if (!existsSync(ignorePath)) {
        return { content: '', path: ignorePath, exists: false };
      }
      
      const content = readFileSync(ignorePath, 'utf-8');
      return { content, path: ignorePath, exists: true };
    } catch (error) {
      return { content: '', path: '', exists: false };
    }
  });

  ipcMain.handle('write-ignore', async (_event, repoRoot: string, content: string) => {
    const result = writeIgnoreFile(repoRoot, content);
    const suggested = computeSuggestedExcludes(repoRoot);
    const defaults = computeDefaultScope(repoRoot);
    const scopeState = getOrCreateScope(repoRoot);
    setScopeState(repoRoot, scopeState.scope, { lastSuggested: suggested });
    const indexedFiles = result.success ? indexRepository(repoRoot) : [];
    return {
      ...result,
      suggested,
      defaultScope: defaults.scope,
      topLevelFolders: defaults.topLevel,
      indexedCount: indexedFiles.length,
      indexStatus: getIndexStatus(repoRoot),
    };
  });
}
