import { useCallback } from 'react';
import { useAppStateContext } from './useAppStateContext';

/**
 * Hook for repository-related operations
 */
export function useRepositoryActions() {
  const { state, updateState } = useAppStateContext();
  const handleBrowseRepo = useCallback(async () => {
    try {
      const selectedPath = await window.inscribeAPI.selectRepository(state.repoRoot || undefined);
      if (!selectedPath) return;

      updateState({ 
        repoRoot: selectedPath,
        statusMessage: 'Initializing repository...'
      });

      const result = await window.inscribeAPI.repoInit(selectedPath);
      
      updateState({
        topLevelFolders: result.topLevelFolders || [],
        scope: result.scope || [],
        ignore: result.ignore || { entries: [], source: 'none', path: '' },
        suggested: result.suggested || [],
        indexedCount: result.indexedCount || 0,
        indexStatus: result.indexStatus || { state: 'complete' },
        statusMessage: `Repository initialized: ${result.indexedCount || 0} files indexed`
      });
    } catch (error) {
      console.error('Failed to select repository:', error);
      updateState({ 
        statusMessage: 'Failed to select repository',
        indexStatus: { state: 'error', message: String(error) }
      });
    }
  }, [state.repoRoot, updateState]);

  const initRepo = useCallback(async (repoRoot: string) => {
    try {
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
    } catch (error) {
      console.error('Failed to initialize repository:', error);
      updateState({ 
        statusMessage: 'Failed to initialize repository',
        indexStatus: { state: 'error', message: String(error) }
      });
    }
  }, [updateState]);

  const handleSaveScope = useCallback(async (newScope: string[]) => {
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
  }, [state.repoRoot, updateState]);

  const handleOpenIgnoreEditor = useCallback(async (
    setIgnoreRawContent: (content: string) => void,
    setIgnoreModalOpen: (open: boolean) => void
  ) => {
    if (!state.repoRoot) return;
    
    try {
      const result = await window.inscribeAPI.readIgnoreRaw(state.repoRoot);
      setIgnoreRawContent(result.content || '');
      setIgnoreModalOpen(true);
    } catch (error) {
      console.error('Failed to open ignore editor:', error);
      updateState({ statusMessage: 'Failed to open ignore editor' });
    }
  }, [state.repoRoot, updateState]);

  const handleSaveIgnore = useCallback(async (content: string) => {
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
  }, [state.repoRoot, initRepo, updateState]);

  return {
    handleBrowseRepo,
    handleSaveScope,
    handleOpenIgnoreEditor,
    handleSaveIgnore,
    initRepo,
  };
}
