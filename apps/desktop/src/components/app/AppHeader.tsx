import React from 'react';
import { Breadcrumb, StatusPill } from '../common';
import type { AppMode } from '../../types';

interface PipelineStatusDisplay {
  text: string;
  variant: 'accent' | 'secondary';
  error: boolean;
}

interface AppHeaderProps {
  repoName: string;
  repoRoot: string | null;
  scopeCount: number;
  ignoreCount: number;
  suggestedCount: number;
  indexedCount: number;
  pipelineStatusDisplay: PipelineStatusDisplay;
  mode: AppMode;
  onBrowseRepo: () => void;
  onNavigateStage: (stage: 'parse' | 'review') => void;
  onOpenScopeModal: () => void;
  onOpenIgnoreEditor: () => void;
  onOpenSuggestedList: () => void;
  onOpenIgnoredList: () => void;
}

export function AppHeader({
  repoName,
  repoRoot,
  scopeCount,
  ignoreCount,
  suggestedCount,
  indexedCount,
  pipelineStatusDisplay,
  mode,
  onBrowseRepo,
  onNavigateStage,
  onOpenScopeModal,
  onOpenIgnoreEditor,
  onOpenSuggestedList,
  onOpenIgnoredList,
}: AppHeaderProps) {
  return (
    <header className="top-bar">
      <div className="repo-section">
        <span className="repo-name">{repoName}</span>
        <input
          className="repo-path-input"
          value={repoRoot || ''}
          readOnly
          placeholder="No repository selected"
        />
        <button
          className="folder-btn"
          type="button"
          title="Browse for repository"
          aria-label="Browse for repository"
          onClick={onBrowseRepo}
        >
          📂
        </button>
      </div>

      <div className="status-pills">
        <Breadcrumb
          currentStage={mode === 'intake' ? 'parse' : 'review'}
          onNavigate={onNavigateStage}
        />
        <StatusPill
          variant="secondary"
          isClickable={true}
          onClick={onOpenScopeModal}
          title="Click to configure scope"
        >
          Scope: {scopeCount}
        </StatusPill>
        <StatusPill
          variant="secondary"
          isClickable={true}
          onClick={onOpenIgnoreEditor}
          title="Click to edit ignore file"
        >
          Ignore: {ignoreCount}
        </StatusPill>
        <StatusPill
          variant="secondary"
          isClickable={true}
          onClick={onOpenSuggestedList}
          title="Click to view suggested excludes"
        >
          Suggested: {suggestedCount}
        </StatusPill>
        <StatusPill
          isClickable={true}
          onClick={onOpenIgnoredList}
          title="Click to view ignored paths"
        >
          Indexed: {indexedCount} files
        </StatusPill>
        <StatusPill variant={pipelineStatusDisplay.variant} error={pipelineStatusDisplay.error}>
          {pipelineStatusDisplay.text}
        </StatusPill>
      </div>
    </header>
  );
}
