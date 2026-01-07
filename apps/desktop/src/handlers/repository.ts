/**
 * Repository-related handlers
 */

declare global {
  interface Window {
    inscribeAPI: any;
  }
}

type StateSetters = {
  setTopLevelFolders: (folders: string[]) => void;
  setScope: (scope: string[]) => void;
  setIgnore: (ignore: any) => void;
  setSuggested: (suggested: string[]) => void;
  setIndexedCount: (count: number) => void;
  setIndexStatus: (status: any) => void;
  setStatusMessage: (message: string) => void;
  setRepoRoot: (root: string | null) => void;
};

export function createRepositoryHandlers(setters: StateSetters) {
  const {
    setTopLevelFolders,
    setScope,
    setIgnore,
    setSuggested,
    setIndexedCount,
    setIndexStatus,
    setStatusMessage,
    setRepoRoot,
  } = setters;

  const initRepo = async (repoRoot: string) => {
    try {
      setStatusMessage('Initializing repository...');
      const result = await window.inscribeAPI.repoInit(repoRoot);
      
      setTopLevelFolders(result.topLevelFolders || []);
      setScope(result.scope || []);
      setIgnore(result.ignore || { entries: [], source: 'none', path: '' });
      setSuggested(result.suggested || []);
      setIndexedCount(result.indexedCount || 0);
      setIndexStatus(result.indexStatus || { state: 'complete' });
      setStatusMessage(`Repository initialized: ${result.indexedCount || 0} files indexed`);
    } catch (error) {
      console.error('Failed to initialize repository:', error);
      setStatusMessage('Failed to initialize repository');
      setIndexStatus({ state: 'error', message: String(error) });
    }
  };

  const handleBrowseRepo = async (currentRepoRoot: string | null) => {
    try {
      const selectedPath = await window.inscribeAPI.selectRepository(currentRepoRoot || undefined);
      if (selectedPath) {
        setRepoRoot(selectedPath);
        await initRepo(selectedPath);
      }
    } catch (error) {
      console.error('Failed to select repository:', error);
      setStatusMessage('Failed to select repository');
    }
  };

  return {
    initRepo,
    handleBrowseRepo,
  };
}
