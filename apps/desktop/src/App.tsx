import React, { useCallback, useEffect, useState } from 'react';
import './App.css';
import { useAppState } from './useAppState';
import { ScopeModal } from './components/ScopeModal';
import { IgnoreEditorModal } from './components/IgnoreEditorModal';
import { ListModal } from './components/ListModal';
import { buildReviewItems, buildApplyPlanFromItems, getPathBasename, toSentenceCase } from './utils';

declare global {
  interface Window {
    inscribeAPI: any;
  }
}

export default function App() {
  const {
    state,
    updateState,
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

  // Initialize repo state
  const initRepo = useCallback(async (repoRoot: string) => {
    try {
      setStatusMessage('Initializing repository...');
      const result = await window.inscribeAPI.repoInit(repoRoot);
      
      setTopLevelFolders(result.topLevelFolders || []);
      setScope(result.scope || []);
      setIgnore(result.ignore || { entries: [], source: 'none', path: '' });
      setSuggested(result.suggested || []);
      setIndexedCount(result.indexedCount || 0);
      setIndexStatus(result.indexStatus || { state: 'complete' });
      setStatusMessage(`Repository initialized: ${result.indexedCount || 0} files indexed`);
    } catch (error) {
      console.error('Failed to initialize repository:', error);
      setStatusMessage('Failed to initialize repository');
      setIndexStatus({ state: 'error', message: String(error) });
    }
  }, [setTopLevelFolders, setScope, setIgnore, setSuggested, setIndexedCount, setIndexStatus, setStatusMessage]);

  // Browse for repository
  const handleBrowseRepo = useCallback(async () => {
    try {
      const selectedPath = await window.inscribeAPI.selectRepository(state.repoRoot || undefined);
      if (selectedPath) {
        setRepoRoot(selectedPath);
        await initRepo(selectedPath);
      }
    } catch (error) {
      console.error('Failed to select repository:', error);
      setStatusMessage('Failed to select repository');
    }
  }, [state.repoRoot, setRepoRoot, initRepo, setStatusMessage]);

  // Handle scope save
  const handleSaveSope = useCallback(async (newScope: string[]) => {
    if (!state.repoRoot) return;
    
    try {
      setStatusMessage('Updating scope...');
      const result = await window.inscribeAPI.setScope(state.repoRoot, newScope);
      setScope(result.scope || newScope);
      setIndexedCount(result.indexedCount || 0);
      setIndexStatus(result.indexStatus || { state: 'complete' });
      setStatusMessage(`Scope updated: ${result.indexedCount || 0} files indexed`);
    } catch (error) {
      console.error('Failed to update scope:', error);
      setStatusMessage('Failed to update scope');
    }
  }, [state.repoRoot, setScope, setIndexedCount, setIndexStatus, setStatusMessage]);

  // Open ignore editor
  const handleOpenIgnoreEditor = useCallback(async () => {
    if (!state.repoRoot) return;
    
    try {
      const result = await window.inscribeAPI.readIgnoreRaw(state.repoRoot);
      setIgnoreRawContent(result.content || '');
      setIgnoreModalOpen(true);
    } catch (error) {
      console.error('Failed to read ignore file:', error);
      setStatusMessage('Failed to read ignore file');
    }
  }, [state.repoRoot, setStatusMessage]);

  // Handle ignore save
  const handleSaveIgnore = useCallback(async (content: string) => {
    if (!state.repoRoot) return;
    
    try {
      setStatusMessage('Updating ignore rules...');
      const result = await window.inscribeAPI.writeIgnore(state.repoRoot, content);
      
      if (result.success) {
        setSuggested(result.suggested || []);
        setIndexedCount(result.indexedCount || 0);
        setIndexStatus(result.indexStatus || { state: 'complete' });
        await initRepo(state.repoRoot); // Refresh full state
        setStatusMessage(`Ignore rules updated: ${result.indexedCount || 0} files indexed`);
      } else {
        setStatusMessage(`Failed to update ignore rules: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to update ignore file:', error);
      setStatusMessage('Failed to update ignore file');
    }
  }, [state.repoRoot, setSuggested, setIndexedCount, setIndexStatus, initRepo, setStatusMessage]);

  // Parse code blocks
  const handleParseBlocks = useCallback(async () => {
    if (!state.repoRoot) {
      setStatusMessage('Error: No repository selected');
      setParseErrors(['No repository selected. Please select a repository first.']);
      return;
    }

    if (!state.aiInput.trim()) {
      setStatusMessage('Error: No input provided');
      setParseErrors(['No input provided. Please paste AI response.']);
      return;
    }

    try {
      setStatusMessage('Parsing code blocks...');
      const parseResult = await window.inscribeAPI.parseBlocks(state.aiInput);
      
      if (parseResult.errors && parseResult.errors.length > 0) {
        setParseErrors(parseResult.errors);
        setStatusMessage(`Parse failed: ${parseResult.errors.length} error(s)`);
        return;
      }

      setParseErrors([]);
      setParsedBlocks(parseResult.blocks || []);

      // Validate blocks
      setStatusMessage('Validating blocks...');
      const validationErrors = await window.inscribeAPI.validateBlocks(
        parseResult.blocks || [],
        state.repoRoot
      );
      
      setValidationErrors(validationErrors || []);

      // Build review items
      const reviewItems = buildReviewItems(parseResult.blocks || [], validationErrors || []);
      setReviewItems(reviewItems);

      // Select first item
      if (reviewItems.length > 0) {
        setSelectedItemId(reviewItems[0].id);
      }

      // Navigate to review
      setMode('review');
      const errorCount = validationErrors?.length || 0;
      if (errorCount > 0) {
        setStatusMessage(`Ready to review: ${reviewItems.length} files, ${errorCount} validation error(s)`);
      } else {
        setStatusMessage(`Ready to review: ${reviewItems.length} files`);
      }
    } catch (error) {
      console.error('Failed to parse blocks:', error);
      setParseErrors([String(error)]);
      setStatusMessage('Failed to parse blocks');
    }
  }, [state.repoRoot, state.aiInput, setParseErrors, setParsedBlocks, setValidationErrors, setReviewItems, setSelectedItemId, setMode, setStatusMessage]);

  // Select review item
  const handleSelectItem = useCallback((id: string) => {
    setSelectedItemId(id);
    setIsEditing(false);
  }, [setSelectedItemId, setIsEditing]);

  // Handle editor change
  const handleEditorChange = useCallback((value: string) => {
    if (state.selectedItemId) {
      updateReviewItemContent(state.selectedItemId, value);
      setStatusMessage('Modified (not applied)');
    }
  }, [state.selectedItemId, updateReviewItemContent, setStatusMessage]);

  // Reset all to original
  const handleResetAll = useCallback(() => {
    const resetItems = state.reviewItems.map(item => ({
      ...item,
      editedContent: item.originalContent,
    }));
    setReviewItems(resetItems);
    setStatusMessage('Reset all to original content');
  }, [state.reviewItems, setReviewItems, setStatusMessage]);

  // Apply selected
  const handleApplySelected = useCallback(async () => {
    if (!state.repoRoot || !state.selectedItemId) return;
    
    const selectedItem = state.reviewItems.find(item => item.id === state.selectedItemId);
    if (!selectedItem) return;

    if (selectedItem.status === 'invalid') {
      setStatusMessage(`Cannot apply: ${selectedItem.validationError}`);
      return;
    }

    try {
      setStatusMessage('Applying selected file...');
      const plan = buildApplyPlanFromItems([selectedItem]);
      const result = await window.inscribeAPI.applyChanges(plan, state.repoRoot);
      
      if (result.success) {
        setLastAppliedPlan(plan);
        setStatusMessage(`✓ Applied: ${selectedItem.file}`);
        await initRepo(state.repoRoot); // Refresh state
      } else {
        setStatusMessage(`Failed to apply: ${result.errors?.join(', ') || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to apply selected:', error);
      setStatusMessage(`Failed to apply: ${error}`);
    }
  }, [state.repoRoot, state.selectedItemId, state.reviewItems, setLastAppliedPlan, setStatusMessage, initRepo]);

  // Apply all
  const handleApplyAll = useCallback(async () => {
    if (!state.repoRoot) return;
    
    // Check for invalid items
    const invalidItems = state.reviewItems.filter(item => item.status === 'invalid');
    if (invalidItems.length > 0) {
      setStatusMessage(`Cannot apply: ${invalidItems.length} file(s) have validation errors`);
      return;
    }

    if (state.reviewItems.length === 0) {
      setStatusMessage('No files to apply');
      return;
    }

    try {
      setStatusMessage(`Applying ${state.reviewItems.length} file(s)...`);
      const plan = buildApplyPlanFromItems(state.reviewItems);
      const result = await window.inscribeAPI.applyChanges(plan, state.repoRoot);
      
      if (result.success) {
        setLastAppliedPlan(plan);
        setStatusMessage(`✓ Applied all: ${state.reviewItems.length} file(s)`);
        await initRepo(state.repoRoot); // Refresh state
      } else {
        setStatusMessage(`Failed to apply: ${result.errors?.join(', ') || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to apply all:', error);
      setStatusMessage(`Failed to apply all: ${error}`);
    }
  }, [state.repoRoot, state.reviewItems, setLastAppliedPlan, setStatusMessage, initRepo]);

  // Undo
  const handleUndo = useCallback(async () => {
    if (!state.repoRoot) return;
    
    try {
      setStatusMessage('Undoing last apply...');
      const result = await window.inscribeAPI.undoLastApply(state.repoRoot);
      
      if (result.success) {
        // Keep the plan for redo
        setStatusMessage(`✓ Undo successful: ${result.message}`);
        await initRepo(state.repoRoot); // Refresh state
      } else {
        setStatusMessage(`Undo failed: ${result.message}`);
      }
    } catch (error) {
      console.error('Failed to undo:', error);
      setStatusMessage(`Failed to undo: ${error}`);
    }
  }, [state.repoRoot, setStatusMessage, initRepo]);

  // Redo
  const handleRedo = useCallback(async () => {
    if (!state.repoRoot || !state.lastAppliedPlan) return;
    
    try {
      setStatusMessage('Redoing last apply...');
      const result = await window.inscribeAPI.applyChanges(state.lastAppliedPlan, state.repoRoot);
      
      if (result.success) {
        clearRedo();
        setStatusMessage('✓ Redo successful');
        await initRepo(state.repoRoot); // Refresh state
      } else {
        setStatusMessage(`Redo failed: ${result.errors?.join(', ') || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to redo:', error);
      setStatusMessage(`Failed to redo: ${error}`);
    }
  }, [state.repoRoot, state.lastAppliedPlan, clearRedo, setStatusMessage, initRepo]);

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
          <span 
            className="pill pill-secondary clickable" 
            onClick={() => state.repoRoot && setScopeModalOpen(true)}
            title="Click to configure scope"
          >
            Scope: {state.scope.length}
          </span>
          <span 
            className="pill pill-secondary clickable" 
            onClick={() => state.repoRoot && handleOpenIgnoreEditor()}
            title="Click to edit ignore file"
          >
            Ignore: {state.ignore.entries.length}
          </span>
          <span 
            className="pill pill-secondary clickable" 
            onClick={() => setSuggestedListModalOpen(true)}
            title="Click to view suggested excludes"
          >
            Suggested: {state.suggested.length}
          </span>
          <span 
            className="pill clickable"
            onClick={() => setIgnoredListModalOpen(true)}
            title="Click to view ignored paths"
          >
            Indexed: {state.indexedCount} files
          </span>
          <span className={`pill accent ${state.indexStatus.state === 'error' ? 'error' : ''}`}>
            {toSentenceCase(state.indexStatus.state)}
          </span>
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
            <div className="empty-state">
              <div className="empty-icon">📄</div>
              <p>Paste AI response to begin</p>
            </div>
          )}

          {state.mode === 'review' && (
            <ul className="file-list">
              {state.reviewItems.map((item) => (
                <li
                  key={item.id}
                  className={`file-item ${state.selectedItemId === item.id ? 'selected' : ''}`}
                  onClick={() => handleSelectItem(item.id)}
                >
                  <div className="file-header">
                    <span
                      className={`status-icon ${item.status === 'invalid' ? 'error' : item.status === 'warning' ? 'warn' : 'success'}`}
                      role="img"
                      aria-label={item.status}
                      title={item.validationError || item.status}
                    >
                      {item.status === 'invalid' ? '❌' : item.status === 'warning' ? '⚠' : '✅'}
                    </span>
                    <span className="file-path">{item.file}</span>
                  </div>
                  <div className="meta">
                    <span>{item.lineCount} lines</span>
                    <span>•</span>
                    <span>{item.language}</span>
                    <span>•</span>
                    <span>{item.mode}</span>
                  </div>
                  {item.validationError && (
                    <div className="validation-error-hint" title={item.validationError}>
                      {item.validationError.substring(0, 50)}...
                    </div>
                  )}
                </li>
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
                <button 
                  className="primary-btn" 
                  type="button" 
                  onClick={handleParseBlocks}
                  disabled={!state.repoRoot}
                  title={!state.repoRoot ? 'Select a repository first' : ''}
                >
                  Parse Code Blocks
                </button>
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
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => setIsEditing(!state.isEditing)}
                  disabled={!selectedItem}
                >
                  {state.isEditing ? 'Preview' : 'Edit'}
                </button>
              </div>

              {selectedItem?.validationError && (
                <div className="error-banner">
                  <strong>Validation Error:</strong> {selectedItem.validationError}
                </div>
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
                <button type="button" onClick={handleUndo}>
                  Undo Apply
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
                <button 
                  type="button" 
                  className="ghost-btn" 
                  onClick={handleApplySelected}
                  disabled={!selectedItem || selectedItem.status === 'invalid'}
                >
                  Apply Selected
                </button>
                <button 
                  type="button" 
                  className="primary-btn" 
                  onClick={handleApplyAll}
                  disabled={state.reviewItems.some(item => item.status === 'invalid')}
                >
                  Apply All Changes
                </button>
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
        onSave={handleSaveSope}
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
