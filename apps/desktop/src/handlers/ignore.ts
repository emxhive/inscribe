/**
 * Ignore-related handlers
 */

type IgnoreStateSetters = {
  setSuggested: (suggested: string[]) => void;
  setIndexedCount: (count: number) => void;
  setIndexStatus: (status: any) => void;
  setStatusMessage: (message: string) => void;
};

export function createIgnoreHandlers(
  setters: IgnoreStateSetters,
  initRepo: (repoRoot: string) => Promise<void>
) {
  const { setSuggested, setIndexedCount, setIndexStatus, setStatusMessage } = setters;

  const handleOpenIgnoreEditor = async (repoRoot: string | null, setIgnoreRawContent: (content: string) => void, setIgnoreModalOpen: (open: boolean) => void) => {
    if (!repoRoot) return;
    
    try {
      const result = await window.inscribeAPI.readIgnoreRaw(repoRoot);
      setIgnoreRawContent(result.content || '');
      setIgnoreModalOpen(true);
    } catch (error) {
      console.error('Failed to read ignore file:', error);
      setStatusMessage('Failed to read ignore file');
    }
  };

  const handleSaveIgnore = async (repoRoot: string | null, content: string) => {
    if (!repoRoot) return;
    
    try {
      setStatusMessage('Updating ignore rules...');
      const result = await window.inscribeAPI.writeIgnore(repoRoot, content);
      
      if (result.success) {
        setSuggested(result.suggested || []);
        setIndexedCount(result.indexedCount || 0);
        setIndexStatus(result.indexStatus || { state: 'complete' });
        await initRepo(repoRoot); // Refresh full state
        setStatusMessage(`Ignore rules updated: ${result.indexedCount || 0} files indexed`);
      } else {
        setStatusMessage(`Failed to update ignore rules: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to update ignore file:', error);
      setStatusMessage('Failed to update ignore file');
    }
  };

  return {
    handleOpenIgnoreEditor,
    handleSaveIgnore,
  };
}
