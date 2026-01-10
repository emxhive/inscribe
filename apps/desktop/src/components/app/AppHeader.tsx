import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Folder, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useRepositoryActions, useAppStateContext } from '../../hooks';
import { getPathBasename, toSentenceCase } from '../../utils';

interface PipelineStatusDisplay {
  text: string;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  icon?: React.ReactNode;
}

interface AppHeaderProps {
  onOpenScopeModal: () => void;
  onOpenIgnoreEditor: () => void;
  onOpenSuggestedList: () => void;
  onOpenIgnoredList: () => void;
}

export function AppHeader({
  onOpenScopeModal,
  onOpenIgnoreEditor,
  onOpenSuggestedList,
  onOpenIgnoredList,
}: AppHeaderProps) {
  const { state, updateState } = useAppStateContext();
  const repositoryActions = useRepositoryActions();
  const repoName = getPathBasename(state.repoRoot || '') || 'Repository';
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

  const handleIgnoreClick = () => {
    requireRepository(onOpenIgnoreEditor, 'Select a repository to edit ignore rules.');
  };

  const pipelineStatusDisplay: PipelineStatusDisplay = (() => {
    switch (state.pipelineStatus) {
      case 'parsing':
        return { text: 'Parsing...', variant: 'default', icon: <Loader2 className="h-3 w-3 animate-spin" /> };
      case 'parse-success':
        return { text: 'Parse Success', variant: 'default', icon: <CheckCircle2 className="h-3 w-3" /> };
      case 'parse-failure':
        return { text: 'Parse Failed', variant: 'destructive', icon: <AlertCircle className="h-3 w-3" /> };
      case 'applying':
        return { text: 'Applying...', variant: 'default', icon: <Loader2 className="h-3 w-3 animate-spin" /> };
      case 'apply-success':
        return { text: 'Apply Success', variant: 'default', icon: <CheckCircle2 className="h-3 w-3" /> };
      case 'apply-failure':
        return { text: 'Apply Failed', variant: 'destructive', icon: <AlertCircle className="h-3 w-3" /> };
      default:
        const isError = state.indexStatus.state === 'error';
        return { 
          text: toSentenceCase(state.indexStatus.state), 
          variant: isError ? 'destructive' : 'default',
          icon: isError ? <AlertCircle className="h-3 w-3" /> : undefined
        };
    }
  })();

  return (
    <header className="flex items-center gap-3 px-4 py-3 bg-card border-b border-border shadow-sm sticky top-0 z-10">
      <div className="flex items-center gap-2 flex-1 min-w-[300px]">
        <span className="text-sm font-medium text-foreground whitespace-nowrap">{repoName}</span>
        <input
          className="flex-1 border border-input bg-secondary rounded-md px-2.5 py-1.5 text-xs text-muted-foreground h-7 focus:outline-none"
          value={state.repoRoot || ''}
          readOnly
          placeholder="No repository selected"
        />
        <button
          className="w-7 h-7 border border-input rounded-md bg-secondary hover:bg-accent hover:text-accent-foreground hover:border-accent flex items-center justify-center transition-colors flex-shrink-0"
          type="button"
          title="Browse for repository"
          aria-label="Browse for repository"
          onClick={repositoryActions.handleBrowseRepo}
        >
          <Folder className="h-4 w-4" />
        </button>
      </div>

      <div className="flex gap-2 items-center flex-wrap justify-end">
        <Badge
          variant="secondary"
          className={hasRepository ? "cursor-pointer hover:opacity-80 transition-opacity border-0" : "border-0"}
          onClick={handleScopeClick}
          title="Click to configure scope"
        >
          Scope: {state.scope.length}
        </Badge>
        <Badge
          variant="secondary"
          className={hasRepository ? "cursor-pointer hover:opacity-80 transition-opacity border-0" : "border-0"}
          onClick={handleIgnoreClick}
          title="Click to edit ignore file"
        >
          Ignore: {state.ignore.entries.length}
        </Badge>
        <Badge
          variant="secondary"
          className="cursor-pointer hover:opacity-80 transition-opacity border-0"
          onClick={onOpenSuggestedList}
          title="Click to view suggested excludes"
        >
          Suggested Excludes: {state.suggested.length}
        </Badge>
        <Badge
          variant="secondary"
          className="cursor-pointer hover:opacity-80 transition-opacity border-0"
          onClick={onOpenIgnoredList}
          title="Click to view indexed files"
        >
          Indexed: {state.indexedCount} files
        </Badge>
        <Badge variant={pipelineStatusDisplay.variant} className="border-0 gap-1">
          {pipelineStatusDisplay.icon}
          {pipelineStatusDisplay.text}
        </Badge>
      </div>
    </header>
  );
}
