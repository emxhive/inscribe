import { useAppStateContext } from './useAppStateContext';
import type { AppState } from '../types';

export async function initRepositoryState(
  repoRoot: string,
  updateState: (updates: Partial<AppState>) => void
) {
  updateState({ statusMessage: 'Initializing repository...' });
  const result = await window.inscribeAPI.repoInit(repoRoot);

  updateState({
    topLevelFolders: result.topLevelFolders || [],
    scope: result.scope || [],
    ignore: result.ignore || { entries: [], source: 'none', path: '' },
    suggested: result.suggested || [],
    indexedCount: result.indexedCount || 0,
    indexStatus: result.indexStatus || { state: 'complete' },
    statusMessage: `Repository initialized: ${result.indexedCount || 0} files indexed`
  });
}

/**
 * Hook for repository-related operations
 */
export function useRepositoryActions() {
  const { state, updateState } = useAppStateContext();
  const handleBrowseRepo = async () => {
    try {
      const selectedPath = await window.inscribeAPI.selectRepository(state.repoRoot || undefined);
      if (!selectedPath) return;

      updateState({ 
        repoRoot: selectedPath,
        statusMessage: 'Initializing repository...'
      });

      await initRepositoryState(selectedPath, updateState);
    } catch (error) {
      console.error('Failed to select repository:', error);
      updateState({ 
        statusMessage: 'Failed to select repository',
        indexStatus: { state: 'error', message: String(error) }
      });
    }
  };

  const initRepo = async (repoRoot: string) => {
    try {
      await initRepositoryState(repoRoot, updateState);
    } catch (error) {
      console.error('Failed to initialize repository:', error);
      updateState({ 
        statusMessage: 'Failed to initialize repository',
        indexStatus: { state: 'error', message: String(error) }
      });
    }
  };

  const handleSaveScope = async (newScope: string[]) => {
    if (!state.repoRoot) return;
    
    try {
      updateState({ statusMessage: 'Updating scope...' });
      const result = await window.inscribeAPI.setScope(state.repoRoot, newScope);
      
      updateState({
        scope: result.scope || newScope,
        indexedCount: result.indexedCount || 0,
        indexStatus: result.indexStatus || { state: 'complete' },
        statusMessage: `Scope updated: ${result.indexedCount || 0} files indexed`
      });
    } catch (error) {
      console.error('Failed to update scope:', error);
      updateState({ 
        statusMessage: 'Failed to update scope',
        indexStatus: { state: 'error', message: String(error) }
      });
    }
  };

  const handleSaveIgnore = async (content: string) => {
    if (!state.repoRoot) return;
    
    try {
      updateState({ statusMessage: 'Saving ignore file...' });
      const result = await window.inscribeAPI.writeIgnore(state.repoRoot, content);
      
      if (result.success) {
        updateState({
          suggested: result.suggested || [],
          indexedCount: result.indexedCount || 0,
          indexStatus: result.indexStatus || { state: 'complete' },
          statusMessage: `Ignore rules updated: ${result.indexedCount || 0} files indexed`
        });
        await initRepo(state.repoRoot);
      } else {
        updateState({ statusMessage: `Failed to update ignore rules: ${result.error || 'Unknown error'}` });
      }
    } catch (error) {
      console.error('Failed to save ignore file:', error);
      updateState({ statusMessage: 'Failed to save ignore file' });
    }
  };

  return {
    handleBrowseRepo,
    handleSaveScope,
    handleSaveIgnore,
    initRepo,
  };
}
