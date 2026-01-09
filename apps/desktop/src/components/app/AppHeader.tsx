import React, { useCallback, useMemo } from 'react';
import { Breadcrumb, StatusPill } from '../common';
import { useRepositoryActions, useAppStateContext } from '../../hooks';
import { getPathBasename, toSentenceCase } from '../../utils';

interface PipelineStatusDisplay {
  text: string;
  variant: 'accent' | 'secondary';
  error: boolean;
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

  const requireRepository = useCallback((action: () => void, message: string) => {
    if (!hasRepository) {
      updateState({ statusMessage: message });
      return;
    }
    action();
  }, [hasRepository, updateState]);

  const handleScopeClick = useCallback(() => {
    requireRepository(onOpenScopeModal, 'Select a repository to configure scope.');
  }, [onOpenScopeModal, requireRepository]);

  const handleIgnoreClick = useCallback(() => {
    requireRepository(onOpenIgnoreEditor, 'Select a repository to edit ignore rules.');
  }, [onOpenIgnoreEditor, requireRepository]);

  const handleNavigateToMode = useCallback((targetMode: 'parse' | 'review') => {
    if (targetMode === 'parse') {
      updateState({ mode: 'intake', pipelineStatus: 'idle' });
    } else if (targetMode === 'review') {
      updateState({ mode: 'review' });
    }
  }, [updateState]);

  const pipelineStatusDisplay = useMemo<PipelineStatusDisplay>(() => {
    switch (state.pipelineStatus) {
      case 'parsing':
        return { text: 'Parsing...', variant: 'accent', error: false };
      case 'parse-success':
        return { text: 'Parse Success', variant: 'accent', error: false };
      case 'parse-failure':
        return { text: 'Parse Failed', variant: 'accent', error: true };
      case 'applying':
        return { text: 'Applying...', variant: 'accent', error: false };
      case 'apply-success':
        return { text: 'Apply Success', variant: 'accent', error: false };
      case 'apply-failure':
        return { text: 'Apply Failed', variant: 'accent', error: true };
      default:
        return { text: toSentenceCase(state.indexStatus.state), variant: 'accent', error: state.indexStatus.state === 'error' };
    }
  }, [state.pipelineStatus, state.indexStatus.state]);

  return (
    <header className="top-bar">
      <div className="repo-section">
        <span className="repo-name">{repoName}</span>
        <input
          className="repo-path-input"
          value={state.repoRoot || ''}
          readOnly
          placeholder="No repository selected"
        />
        <button
          className="folder-btn"
          type="button"
          title="Browse for repository"
          aria-label="Browse for repository"
          onClick={repositoryActions.handleBrowseRepo}
        >
          📂
        </button>
      </div>

      <div className="status-pills">
        <Breadcrumb
          currentStage={state.mode === 'intake' ? 'parse' : 'review'}
          onNavigate={handleNavigateToMode}
        />
        <StatusPill
          variant="secondary"
          isClickable={hasRepository}
          onClick={handleScopeClick}
          title="Click to configure scope"
        >
          Scope: {state.scope.length}
        </StatusPill>
        <StatusPill
          variant="secondary"
          isClickable={hasRepository}
          onClick={handleIgnoreClick}
          title="Click to edit ignore file"
        >
          Ignore: {state.ignore.entries.length}
        </StatusPill>
        <StatusPill
          variant="secondary"
          isClickable={true}
          onClick={onOpenSuggestedList}
          title="Click to view suggested excludes"
        >
          Suggested: {state.suggested.length}
        </StatusPill>
        <StatusPill
          isClickable={true}
          onClick={onOpenIgnoredList}
          title="Click to view ignored paths"
        >
          Indexed: {state.indexedCount} files
        </StatusPill>
        <StatusPill variant={pipelineStatusDisplay.variant} error={pipelineStatusDisplay.error}>
          {pipelineStatusDisplay.text}
        </StatusPill>
      </div>
    </header>
  );
}
