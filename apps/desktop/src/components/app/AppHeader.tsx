import React, { useState, useEffect, useRef } from 'react';
import { Folder, CheckCircle2, AlertCircle, Loader2, Clock } from 'lucide-react';
import { useRepositoryActions, useAppStateContext } from '@/hooks';
import { getPathBasename } from '@/utils';

interface AppHeaderProps {
  onOpenScopeModal: () => void;
  onOpenIgnore: () => void;
  onOpenIndexedList: () => void;
}

export function AppHeader({
  onOpenScopeModal,
  onOpenIgnore,
  onOpenIndexedList,
}: AppHeaderProps) {
  const { state, updateState } = useAppStateContext();
  const repositoryActions = useRepositoryActions();
  const repoName = getPathBasename(state.repoRoot || '');
  const hasRepository = Boolean(state.repoRoot);
  
  const [recentProjects, setRecentProjects] = useState<string[]>([]);
  const [showRecent, setShowRecent] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.inscribeAPI.getRecentProjects().then(setRecentProjects);
    return window.inscribeAPI.onRecentProjectsUpdated(setRecentProjects);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowRecent(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const handleIgnoreClick = () => {
    requireRepository(onOpenIgnore, 'Select a repository to edit ignore rules.');
  };

  const handleRecentClick = (path: string) => {
    window.inscribeAPI.openRepository(path);
    setShowRecent(false);
  };

  return (
    <header className="flex items-center gap-3 px-4 py-2.5 bg-card border-b border-border shadow-sm flex-shrink-0 h-[52px] relative z-50">
      {/* Repository section */}
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-32 flex-shrink-0">
          <span className="text-sm font-semibold text-foreground truncate block" title={repoName || 'Repository'}>
            {repoName || 'Repository'}
          </span>
        </div>
        <div className="relative flex items-center">
          <input
            className="w-80 border border-input bg-secondary rounded-md px-2.5 py-1.5 text-xs font-semibold text-foreground placeholder:text-muted-foreground h-8 focus:outline-none"
            value={state.repoRoot || ''}
            readOnly
            placeholder="No repository selected"
            title={state.repoRoot || ''}
          />
          {recentProjects.length > 0 && (
            <button
              className="absolute right-2 p-1 hover:bg-accent rounded-sm transition-colors"
              onClick={() => setShowRecent(!showRecent)}
              title="Recent projects"
            >
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          )}

          {showRecent && (
            <div 
              ref={dropdownRef}
              className="absolute top-full left-0 mt-1 w-full bg-popover border border-border rounded-md shadow-lg py-1 z-[100] max-h-64 overflow-y-auto"
            >
              <div className="px-2 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                Recent Projects
              </div>
              {recentProjects.map((path) => (
                <button
                  key={path}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-accent hover:text-accent-foreground transition-colors truncate"
                  onClick={() => handleRecentClick(path)}
                  title={path}
                >
                  <div className="font-medium truncate">{getPathBasename(path)}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{path}</div>
                </button>
              ))}
            </div>
          )}
        </div>
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
          onClick={handleIgnoreClick}
          title="Click to edit ignore rules"
          disabled={!hasRepository}
        >
          Ignore: {state.ignore.entries.length}
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
