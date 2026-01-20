import React from 'react';
import { Folder, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useRepositoryActions, useAppStateContext } from '@/hooks';
import { getPathBasename } from '@/utils';

interface AppHeaderProps {
  onOpenScopeModal: () => void;
  onOpenIgnoredList: () => void;
  onOpenIgnoreEditor: () => void;
  onOpenSuggestedList: () => void;
  onOpenIndexedList: () => void;
}

export function AppHeader({
  onOpenScopeModal,
  onOpenIgnoredList,
  onOpenIgnoreEditor,
  onOpenSuggestedList,
  onOpenIndexedList,
}: AppHeaderProps) {
  const { state, updateState } = useAppStateContext();
  const repositoryActions = useRepositoryActions();
  const repoName = getPathBasename(state.repoRoot || '');
  const hasRepository = Boolean(state.repoRoot);

  const requireRepository = (action: () => void, message: string) => {
    if (!hasRepository) {
      updateState({ statusMessage: message });
      return;
    }
    action();
  };

  const handleScopeClick = () => {
    requireRepository(onOpenScopeModal, 'Select a repository to configure scope.');
  };

  const handleIgnoredListClick = () => {
    requireRepository(onOpenIgnoredList, 'Select a repository to view ignored paths.');
  };

  const handleIgnoreEditorClick = () => {
    requireRepository(onOpenIgnoreEditor, 'Select a repository to edit ignore rules.');
  };

  return (
    <header className="flex items-center gap-3 px-4 py-2.5 bg-card border-b border-border shadow-sm flex-shrink-0 h-[52px]">
      {/* Repository section */}
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-32 flex-shrink-0">
          <span className="text-sm font-semibold text-foreground truncate block" title={repoName || 'Repository'}>
            {repoName || 'Repository'}
          </span>
        </div>
        <input
          className="w-80 border border-input bg-secondary rounded-md px-2.5 py-1.5 text-xs font-semibold text-foreground placeholder:text-muted-foreground h-8 focus:outline-none"
          value={state.repoRoot || ''}
          readOnly
          placeholder="No repository selected"
          title={state.repoRoot || ''}
        />
        <button
          className="w-8 h-8 border border-input rounded-md bg-secondary hover:bg-accent hover:text-accent-foreground hover:border-accent flex items-center justify-center transition-colors flex-shrink-0"
          type="button"
          title="Browse for repository"
          aria-label="Browse for repository"
          onClick={repositoryActions.handleBrowseRepo}
        >
          <Folder className="h-4 w-4" />
        </button>
      </div>

      {/* Toolbar controls section */}
      <div className="flex gap-4 items-center ml-auto">
        <button
          className="text-xs font-semibold text-muted-foreground hover:text-accent-foreground transition-colors h-8 px-2 rounded hover:bg-accent disabled:opacity-50"
          onClick={handleScopeClick}
          title="Click to configure scope"
          disabled={!hasRepository}
        >
          Scope: {state.scope.length}
        </button>
        <button
          className="text-xs font-semibold text-muted-foreground hover:text-accent-foreground transition-colors h-8 px-2 rounded hover:bg-accent disabled:opacity-50"
          onClick={handleIgnoredListClick}
          title="Click to view ignored paths"
          disabled={!hasRepository}
        >
          Ignore: {state.ignore.entries.length}
        </button>
        <button
          className="text-xs font-semibold text-muted-foreground hover:text-accent-foreground transition-colors h-8 px-2 rounded hover:bg-accent disabled:opacity-50"
          onClick={handleIgnoreEditorClick}
          title="Click to edit ignore file"
          disabled={!hasRepository}
        >
          Edit Ignore
        </button>
        <button
          className="text-xs font-semibold text-muted-foreground hover:text-accent-foreground transition-colors h-8 px-2 rounded hover:bg-accent"
          onClick={onOpenSuggestedList}
          title="Click to view suggested excludes"
        >
          Suggested: {state.suggested.length}
        </button>
        <button
          className="text-xs font-semibold text-muted-foreground hover:text-accent-foreground transition-colors h-8 px-2 rounded hover:bg-accent"
          onClick={onOpenIndexedList}
          title="Click to view indexed files"
        >
          Indexed: {state.indexedCount}
        </button>
      </div>
    </header>
  );
}
