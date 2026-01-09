import React, { useCallback, useEffect, useState, useMemo } from 'react';
import './App.css';
import { useAppState } from './useAppState';
import { ScopeModal } from './components/ScopeModal';
import { IgnoreEditorModal } from './components/IgnoreEditorModal';
import { ListModal } from './components/ListModal';
import { AppHeader } from './components/app/AppHeader';
import { MainContent } from './components/app/MainContent';
import { getPathBasename, toSentenceCase } from './utils';
import {
  createRepositoryHandlers,
  createScopeHandlers,
  createIgnoreHandlers,
  createParsingHandlers,
  createReviewHandlers,
  createApplyHandlers,
} from './handlers';

export default function App() {
  const {
    state,
    setRepoRoot,
    setTopLevelFolders,
    setScope,
    setIgnore,
    setSuggested,
    setIndexedCount,
    setIndexStatus,
    setMode,
    setAiInput,
    setParseErrors,
    setParsedBlocks,
    setValidationErrors,
    setReviewItems,
    setSelectedItemId,
    setIsEditing,
    setStatusMessage,
    updateReviewItemContent,
    setLastAppliedPlan,
    clearRedo,
    setPipelineStatus,
    setIsParsingInProgress,
    setIsApplyingInProgress,
  } = useAppState();

  const [scopeModalOpen, setScopeModalOpen] = useState(false);
  const [ignoreModalOpen, setIgnoreModalOpen] = useState(false);
  const [ignoredListModalOpen, setIgnoredListModalOpen] = useState(false);
  const [suggestedListModalOpen, setSuggestedListModalOpen] = useState(false);
  const [ignoreRawContent, setIgnoreRawContent] = useState('');

  // Create handler instances
  const repositoryHandlers = useMemo(
    () =>
      createRepositoryHandlers({
        setTopLevelFolders,
        setScope,
        setIgnore,
        setSuggested,
        setIndexedCount,
        setIndexStatus,
        setStatusMessage,
        setRepoRoot,
      }),
    [setTopLevelFolders, setScope, setIgnore, setSuggested, setIndexedCount, setIndexStatus, setStatusMessage, setRepoRoot]
  );

  const scopeHandlers = useMemo(
    () => createScopeHandlers({ setScope, setIndexedCount, setIndexStatus, setStatusMessage }),
    [setScope, setIndexedCount, setIndexStatus, setStatusMessage]
  );

  const ignoreHandlers = useMemo(
    () => createIgnoreHandlers({ setSuggested, setIndexedCount, setIndexStatus, setStatusMessage }, repositoryHandlers.initRepo),
    [setSuggested, setIndexedCount, setIndexStatus, setStatusMessage, repositoryHandlers.initRepo]
  );

  const parsingHandlers = useMemo(
    () =>
      createParsingHandlers({
        setParseErrors,
        setParsedBlocks,
        setValidationErrors,
        setReviewItems,
        setSelectedItemId,
        setMode,
        setStatusMessage,
        setPipelineStatus,
        setIsParsingInProgress,
      }),
    [setParseErrors, setParsedBlocks, setValidationErrors, setReviewItems, setSelectedItemId, setMode, setStatusMessage, setPipelineStatus, setIsParsingInProgress]
  );

  const reviewHandlers = useMemo(
    () =>
      createReviewHandlers({
        setSelectedItemId,
        setIsEditing,
        updateReviewItemContent,
        setReviewItems,
        setStatusMessage,
      }),
    [setSelectedItemId, setIsEditing, updateReviewItemContent, setReviewItems, setStatusMessage]
  );

  const applyHandlers = useMemo(
    () => createApplyHandlers({ setLastAppliedPlan, setStatusMessage, clearRedo, setPipelineStatus, setIsApplyingInProgress }, repositoryHandlers.initRepo),
    [setLastAppliedPlan, setStatusMessage, clearRedo, setPipelineStatus, setIsApplyingInProgress, repositoryHandlers.initRepo]
  );

  // Wrap handlers with the current state
  const handleBrowseRepo = useCallback(() => repositoryHandlers.handleBrowseRepo(state.repoRoot), [repositoryHandlers, state.repoRoot]);
  const handleSaveScope = useCallback((newScope: string[]) => scopeHandlers.handleSaveScope(state.repoRoot, newScope), [scopeHandlers, state.repoRoot]);
  const handleOpenIgnoreEditor = useCallback(() => ignoreHandlers.handleOpenIgnoreEditor(state.repoRoot, setIgnoreRawContent, setIgnoreModalOpen), [ignoreHandlers, state.repoRoot]);
  const handleSaveIgnore = useCallback((content: string) => ignoreHandlers.handleSaveIgnore(state.repoRoot, content), [ignoreHandlers, state.repoRoot]);
  const handleParseBlocks = useCallback(() => parsingHandlers.handleParseBlocks(state.repoRoot, state.aiInput), [parsingHandlers, state.repoRoot, state.aiInput]);
  const handleSelectItem = useCallback((id: string) => reviewHandlers.handleSelectItem(id), [reviewHandlers]);
  const handleEditorChange = useCallback((value: string) => reviewHandlers.handleEditorChange(state.selectedItemId, value), [reviewHandlers, state.selectedItemId]);
  const handleResetAll = useCallback(() => reviewHandlers.handleResetAll(state.reviewItems), [reviewHandlers, state.reviewItems]);
  const handleApplySelected = useCallback(() => applyHandlers.handleApplySelected(state.repoRoot, state.selectedItemId, state.reviewItems), [applyHandlers, state.repoRoot, state.selectedItemId, state.reviewItems]);
  const handleApplyAll = useCallback(() => applyHandlers.handleApplyAll(state.repoRoot, state.reviewItems), [applyHandlers, state.repoRoot, state.reviewItems]);
  const handleApplyValidBlocks = useCallback(() => applyHandlers.handleApplyValidBlocks(state.repoRoot, state.reviewItems), [applyHandlers, state.repoRoot, state.reviewItems]);
  const handleUndo = useCallback(() => applyHandlers.handleUndo(state.repoRoot), [applyHandlers, state.repoRoot]);
  const handleRedo = useCallback(() => applyHandlers.handleRedo(state.repoRoot, state.lastAppliedPlan), [applyHandlers, state.repoRoot, state.lastAppliedPlan]);

  // Get the currently selected item
  const selectedItem = state.reviewItems.find(item => item.id === state.selectedItemId);
  const editorValue = selectedItem?.editedContent || '';

  // Get repo name (last segment of path) or default
  const repoName = getPathBasename(state.repoRoot || '') || 'Repository';

  // Memoize valid items count for performance
  const validItemsCount = useMemo(
    () => state.reviewItems.filter(item => item.status !== 'invalid').length,
    [state.reviewItems]
  );

  // Navigation handler for breadcrumb
  // Only allows navigation back to previously completed stages
  const handleNavigateToStage = useCallback((stage: 'parse' | 'review') => {
    if (stage === 'parse') {
      setMode('intake');
      setPipelineStatus('idle');
    } else if (stage === 'review') {
      // Review stage can only be reached by parsing, not by direct navigation
      // This case is included for completeness, but the breadcrumb will disable
      // navigation to future (not yet completed) stages
      setMode('review');
    }
  }, [setMode, setPipelineStatus]);

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
        onBrowseRepo={handleBrowseRepo}
        onNavigateStage={handleNavigateToStage}
        onOpenScopeModal={() => state.repoRoot && setScopeModalOpen(true)}
        onOpenIgnoreEditor={() => state.repoRoot && handleOpenIgnoreEditor()}
        onOpenSuggestedList={() => setSuggestedListModalOpen(true)}
        onOpenIgnoredList={() => setIgnoredListModalOpen(true)}
      />

      <MainContent
        mode={state.mode}
        reviewItems={state.reviewItems}
        selectedItemId={state.selectedItemId}
        selectedItem={selectedItem}
        parseErrors={state.parseErrors}
        aiInput={state.aiInput}
        isEditing={state.isEditing}
        isParsingInProgress={state.isParsingInProgress}
        isApplyingInProgress={state.isApplyingInProgress}
        canRedo={state.canRedo}
        statusMessage={state.statusMessage}
        validItemsCount={validItemsCount}
        editorValue={editorValue}
        onSelectItem={handleSelectItem}
        onAiInputChange={setAiInput}
        onParseBlocks={handleParseBlocks}
        onToggleEditing={() => setIsEditing(!state.isEditing)}
        onEditorChange={handleEditorChange}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onResetAll={handleResetAll}
        onApplySelected={handleApplySelected}
        onApplyValidBlocks={handleApplyValidBlocks}
        onApplyAll={handleApplyAll}
        onStatusMessage={setStatusMessage}
        canParse={Boolean(state.repoRoot)}
      />

      {/* Modals */}
      <ScopeModal
        isOpen={scopeModalOpen}
        onClose={() => setScopeModalOpen(false)}
        topLevelFolders={state.topLevelFolders}
        currentScope={state.scope}
        onSave={handleSaveScope}
        disabled={!state.repoRoot}
      />

      <IgnoreEditorModal
        isOpen={ignoreModalOpen}
        onClose={() => setIgnoreModalOpen(false)}
        currentContent={ignoreRawContent}
        suggested={state.suggested}
        onSave={handleSaveIgnore}
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
