import React, { useCallback, useEffect, useState, useMemo } from 'react';
import './App.css';
import { useAppState } from './useAppState';
import { ScopeModal } from './components/ScopeModal';
import { IgnoreEditorModal } from './components/IgnoreEditorModal';
import { ListModal } from './components/ListModal';
import { Button, StatusPill, EmptyState, FileListItem } from './components/common';
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
      }),
    [setParseErrors, setParsedBlocks, setValidationErrors, setReviewItems, setSelectedItemId, setMode, setStatusMessage]
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
    () => createApplyHandlers({ setLastAppliedPlan, setStatusMessage, clearRedo }, repositoryHandlers.initRepo),
    [setLastAppliedPlan, setStatusMessage, clearRedo, repositoryHandlers.initRepo]
  );

  // Wrap handlers with current state
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
  const handleUndo = useCallback(() => applyHandlers.handleUndo(state.repoRoot), [applyHandlers, state.repoRoot]);
  const handleRedo = useCallback(() => applyHandlers.handleRedo(state.repoRoot, state.lastAppliedPlan), [applyHandlers, state.repoRoot, state.lastAppliedPlan]);

  // Get currently selected item
  const selectedItem = state.reviewItems.find(item => item.id === state.selectedItemId);
  const editorValue = selectedItem?.editedContent || '';

  // Get repo name (last segment of path) or default
  const repoName = getPathBasename(state.repoRoot || '') || 'Repository';

  return (
    <div className="app-shell">
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
            onClick={handleBrowseRepo}
          >
            📂
          </button>
        </div>

        <div className="status-pills">
          <StatusPill 
            variant="secondary"
            isClickable={true}
            onClick={() => state.repoRoot && setScopeModalOpen(true)}
            title="Click to configure scope"
          >
            Scope: {state.scope.length}
          </StatusPill>
          <StatusPill 
            variant="secondary"
            isClickable={true}
            onClick={() => state.repoRoot && handleOpenIgnoreEditor()}
            title="Click to edit ignore file"
          >
            Ignore: {state.ignore.entries.length}
          </StatusPill>
          <StatusPill 
            variant="secondary"
            isClickable={true}
            onClick={() => setSuggestedListModalOpen(true)}
            title="Click to view suggested excludes"
          >
            Suggested: {state.suggested.length}
          </StatusPill>
          <StatusPill 
            isClickable={true}
            onClick={() => setIgnoredListModalOpen(true)}
            title="Click to view ignored paths"
          >
            Indexed: {state.indexedCount} files
          </StatusPill>
          <StatusPill 
            variant="accent"
            error={state.indexStatus.state === 'error'}
          >
            {toSentenceCase(state.indexStatus.state)}
          </StatusPill>
        </div>
      </header>

      <div className="layout">
        <aside className="sidebar">
          <div className="sidebar-header">
            <div>
              <p className="eyebrow">
                {state.mode === 'intake' ? 'Parsed Code Blocks' : 'Code Changes'}
              </p>
              <h3>{state.mode === 'intake' ? '0 files' : `${state.reviewItems.length} files`}</h3>
            </div>
          </div>

          {state.mode === 'intake' && (
            <EmptyState message="Paste AI response to begin" />
          )}

          {state.mode === 'review' && (
            <ul className="file-list">
              {state.reviewItems.map((item) => (
                <FileListItem
                  key={item.id}
                  file={item.file}
                  lineCount={item.lineCount}
                  language={item.language}
                  mode={item.mode}
                  status={item.status}
                  validationError={item.validationError}
                  isSelected={state.selectedItemId === item.id}
                  onClick={() => handleSelectItem(item.id)}
                />
              ))}
            </ul>
          )}
        </aside>

        <main className="main-panel">
          {state.mode === 'intake' && (
            <section className="intake-card">
              <header className="section-header">
                <div>
                  <p className="eyebrow">AI Response Input</p>
                  <h2>Paste the AI reply to parse code blocks</h2>
                </div>
              </header>

              {state.parseErrors.length > 0 && (
                <div className="error-banner">
                  <strong>Parse Errors:</strong>
                  <ul>
                    {state.parseErrors.map((error, idx) => (
                      <li key={idx}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="input-area">
                <textarea
                  placeholder="Paste the AI response here. Must contain @inscribe BEGIN / END blocks."
                  value={state.aiInput}
                  onChange={(e) => setAiInput(e.target.value)}
                />
              </div>

              <footer className="intake-footer">
                <span className="char-count">{state.aiInput.length} characters</span>
                <Button 
                  variant="primary"
                  type="button" 
                  onClick={handleParseBlocks}
                  disabled={!state.repoRoot}
                  title={!state.repoRoot ? 'Select a repository first' : ''}
                >
                  Parse Code Blocks
                </Button>
              </footer>
            </section>
          )}

          {state.mode === 'review' && (
            <section className="review-panel">
              <div className="section-header">
                <div>
                  <p className="eyebrow">Review & Apply</p>
                  <h2>{selectedItem?.file || 'Select a file from the left'}</h2>
                </div>
                <Button
                  variant="ghost"
                  type="button"
                  onClick={() => setIsEditing(!state.isEditing)}
                  disabled={!selectedItem}
                >
                  {state.isEditing ? 'Preview' : 'Edit'}
                </Button>
              </div>

              {selectedItem?.validationError && (
                <div className="error-banner">
                  <strong>Validation Error:</strong> {selectedItem.validationError}
                </div>
              )}

              {selectedItem?.mode === 'range' && (
                <p className="range-help">
                  Range anchors must match exactly and be unique; duplicates fail; no partial apply.
                </p>
              )}

              <div className="editor-shell">
                {state.isEditing ? (
                  <textarea
                    className="code-editor"
                    value={editorValue}
                    onChange={(e) => handleEditorChange(e.target.value)}
                  />
                ) : (
                  <pre className="code-preview">
                    <code>{editorValue}</code>
                  </pre>
                )}
              </div>

              <div className="action-bar">
                <button type="button" onClick={handleUndo} title="Undo last apply (single-step)">
                  Undo last apply (single-step)
                </button>
                <button 
                  type="button" 
                  onClick={handleRedo}
                  disabled={!state.canRedo}
                >
                  Redo Apply
                </button>
                <button type="button" onClick={handleResetAll}>
                  Reset All
                </button>
                <div className="action-spacer" />
                <Button 
                  variant="ghost"
                  type="button" 
                  onClick={handleApplySelected}
                  disabled={!selectedItem || selectedItem.status === 'invalid'}
                >
                  Apply Selected
                </Button>
                <Button 
                  variant="primary"
                  type="button" 
                  onClick={handleApplyAll}
                  disabled={state.reviewItems.some(item => item.status === 'invalid')}
                >
                  Apply All Changes
                </Button>
              </div>

              <div className="status-banner">{state.statusMessage}</div>
            </section>
          )}
        </main>

        <aside className="right-rail">
          <button
            type="button"
            className="rail-btn"
            aria-label="View history"
            onClick={() => setStatusMessage('History (placeholder)')}
          >
            🕑
          </button>
          <button
            type="button"
            className="rail-btn"
            aria-label="Open settings"
            onClick={() => setStatusMessage('Settings (placeholder)')}
          >
            ⚙️
          </button>
          <button
            type="button"
            className="rail-btn"
            aria-label="Show information"
            onClick={() => setStatusMessage('Info (placeholder)')}
          >
            ℹ️
          </button>
        </aside>
      </div>

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
