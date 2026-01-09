import React, { useCallback, useState } from 'react';
import './App.css';
import { 
  useAppState,
  useRepositoryActions,
  useParsingActions,
  useReviewActions,
  useApplyActions
} from './hooks';
import { ScopeModal } from './components/ScopeModal';
import { IgnoreEditorModal } from './components/IgnoreEditorModal';
import { ListModal } from './components/ListModal';
import { AppHeader } from './components/app/AppHeader';
import { MainContent } from './components/app/MainContent';
import { getPathBasename, toSentenceCase } from './utils';

export default function App() {
  const {
    state,
    updateState,
    updateReviewItemContent,
    setLastAppliedPlan,
    clearRedo,
  } = useAppState();

  const [scopeModalOpen, setScopeModalOpen] = useState(false);
  const [ignoreModalOpen, setIgnoreModalOpen] = useState(false);
  const [ignoredListModalOpen, setIgnoredListModalOpen] = useState(false);
  const [suggestedListModalOpen, setSuggestedListModalOpen] = useState(false);
  const [ignoreRawContent, setIgnoreRawContent] = useState('');

  // Initialize action hooks
  const repositoryActions = useRepositoryActions(state, updateState);
  const parsingActions = useParsingActions(state, updateState);
  const reviewActions = useReviewActions(state, updateState, updateReviewItemContent);
  const applyActions = useApplyActions(
    state,
    updateState,
    setLastAppliedPlan,
    clearRedo,
    repositoryActions.initRepo
  );

  // Get repo name (last segment of path) or default
  const repoName = getPathBasename(state.repoRoot || '') || 'Repository';

  // Navigation handler for breadcrumb
  // Only allows navigation back to previously completed mode
  const handleNavigateToMode = useCallback((targetMode: 'parse' | 'review') => {
    if (targetMode === 'parse') {
      updateState({ mode: 'intake', pipelineStatus: 'idle' });
    } else if (targetMode === 'review') {
      // Review mode can only be reached by parsing, not by direct navigation
      updateState({ mode: 'review' });
    }
  }, [updateState]);

  // Get pipeline status display text and variant
  const getPipelineStatusDisplay = () => {
    switch (state.pipelineStatus) {
      case 'parsing':
        return { text: 'Parsing...', variant: 'accent' as const, error: false };
      case 'parse-success':
        return { text: 'Parse Success', variant: 'accent' as const, error: false };
      case 'parse-failure':
        return { text: 'Parse Failed', variant: 'accent' as const, error: true };
      case 'applying':
        return { text: 'Applying...', variant: 'accent' as const, error: false };
      case 'apply-success':
        return { text: 'Apply Success', variant: 'accent' as const, error: false };
      case 'apply-failure':
        return { text: 'Apply Failed', variant: 'accent' as const, error: true };
      default:
        return { text: toSentenceCase(state.indexStatus.state), variant: 'accent' as const, error: state.indexStatus.state === 'error' };
    }
  };

  const pipelineStatusDisplay = getPipelineStatusDisplay();
  const hasRepository = Boolean(state.repoRoot);

  return (
    <div className="app-shell">
      <AppHeader
        repoName={repoName}
        repoRoot={state.repoRoot}
        scopeCount={state.scope.length}
        ignoreCount={state.ignore.entries.length}
        suggestedCount={state.suggested.length}
        indexedCount={state.indexedCount}
        pipelineStatusDisplay={pipelineStatusDisplay}
        mode={state.mode}
        onBrowseRepo={repositoryActions.handleBrowseRepo}
        onNavigateStage={handleNavigateToMode}
        onOpenScopeModal={() => hasRepository && setScopeModalOpen(true)}
        onOpenIgnoreEditor={() => hasRepository && repositoryActions.handleOpenIgnoreEditor(setIgnoreRawContent, setIgnoreModalOpen)}
        onOpenSuggestedList={() => setSuggestedListModalOpen(true)}
        onOpenIgnoredList={() => setIgnoredListModalOpen(true)}
      />

      <MainContent
        mode={state.mode}
        reviewItems={state.reviewItems}
        selectedItemId={state.selectedItemId}
        selectedItem={reviewActions.selectedItem}
        parseErrors={state.parseErrors}
        aiInput={state.aiInput}
        isEditing={state.isEditing}
        isParsingInProgress={state.isParsingInProgress}
        isApplyingInProgress={state.isApplyingInProgress}
        canRedo={state.canRedo}
        statusMessage={state.statusMessage}
        validItemsCount={reviewActions.validItemsCount}
        editorValue={reviewActions.editorValue}
        onSelectItem={reviewActions.handleSelectItem}
        onAiInputChange={(value) => updateState({ aiInput: value })}
        onParseBlocks={parsingActions.handleParseBlocks}
        onToggleEditing={() => updateState({ isEditing: !state.isEditing })}
        onEditorChange={reviewActions.handleEditorChange}
        onUndo={applyActions.handleUndo}
        onRedo={applyActions.handleRedo}
        onResetAll={reviewActions.handleResetAll}
        onApplySelected={applyActions.handleApplySelected}
        onApplyValidBlocks={applyActions.handleApplyValidBlocks}
        onApplyAll={applyActions.handleApplyAll}
        onStatusMessage={(value) => updateState({ statusMessage: value })}
        canParse={hasRepository}
      />

      {/* Modals */}
      <ScopeModal
        isOpen={scopeModalOpen}
        onClose={() => setScopeModalOpen(false)}
        topLevelFolders={state.topLevelFolders}
        currentScope={state.scope}
        onSave={repositoryActions.handleSaveScope}
        disabled={!hasRepository}
      />

      <IgnoreEditorModal
        isOpen={ignoreModalOpen}
        onClose={() => setIgnoreModalOpen(false)}
        currentContent={ignoreRawContent}
        suggested={state.suggested}
        onSave={repositoryActions.handleSaveIgnore}
      />

      <ListModal
        isOpen={ignoredListModalOpen}
        onClose={() => setIgnoredListModalOpen(false)}
        title="Ignored Paths"
        items={state.ignore.entries}
        emptyMessage="No paths are explicitly ignored"
      />

      <ListModal
        isOpen={suggestedListModalOpen}
        onClose={() => setSuggestedListModalOpen(false)}
        title="Suggested Excludes"
        items={state.suggested}
        emptyMessage="No suggested excludes"
      />
    </div>
  );
}
