/**
 * Scope-related handlers
 */
import type { IndexStatus } from '@inscribe/shared';

type ScopeStateSetters = {
  setScope: (scope: string[]) => void;
  setIndexedCount: (count: number) => void;
  setIndexStatus: (status: IndexStatus) => void;
  setStatusMessage: (message: string) => void;
};

export function createScopeHandlers(setters: ScopeStateSetters) {
  const { setScope, setIndexedCount, setIndexStatus, setStatusMessage } = setters;

  const handleSaveScope = async (repoRoot: string | null, newScope: string[]) => {
    if (!repoRoot) return;
    
    try {
      setStatusMessage('Updating scope...');
      const result = await window.inscribeAPI.setScope(repoRoot, newScope);
      setScope(result.scope || newScope);
      setIndexedCount(result.indexedCount || 0);
      setIndexStatus(result.indexStatus || { state: 'complete' });
      setStatusMessage(`Scope updated: ${result.indexedCount || 0} files indexed`);
    } catch (error) {
      console.error('Failed to update scope:', error);
      setStatusMessage('Failed to update scope');
    }
  };

  return {
    handleSaveScope,
  };
}
