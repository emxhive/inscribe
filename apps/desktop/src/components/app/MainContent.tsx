import React from 'react';
import { Button, EmptyState, FileListItem } from '../common';
import type { AppMode, ReviewItem } from '../../types';

interface MainContentProps {
  mode: AppMode;
  reviewItems: ReviewItem[];
  selectedItemId: string | null;
  selectedItem?: ReviewItem;
  parseErrors: string[];
  aiInput: string;
  isEditing: boolean;
  isParsingInProgress: boolean;
  isApplyingInProgress: boolean;
  canRedo: boolean;
  statusMessage: string;
  validItemsCount: number;
  editorValue: string;
  onSelectItem: (id: string) => void;
  onAiInputChange: (value: string) => void;
  onParseBlocks: () => void;
  onToggleEditing: () => void;
  onEditorChange: (value: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onResetAll: () => void;
  onApplySelected: () => void;
  onApplyValidBlocks: () => void;
  onApplyAll: () => void;
  onStatusMessage: (value: string) => void;
  canParse: boolean;
}

export function MainContent({
  mode,
  reviewItems,
  selectedItemId,
  selectedItem,
  parseErrors,
  aiInput,
  isEditing,
  isParsingInProgress,
  isApplyingInProgress,
  canRedo,
  statusMessage,
  validItemsCount,
  editorValue,
  onSelectItem,
  onAiInputChange,
  onParseBlocks,
  onToggleEditing,
  onEditorChange,
  onUndo,
  onRedo,
  onResetAll,
  onApplySelected,
  onApplyValidBlocks,
  onApplyAll,
  onStatusMessage,
  canParse,
}: MainContentProps) {
  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div>
            <p className="eyebrow">
              {mode === 'intake' ? 'Parsed Code Blocks' : 'Code Changes'}
            </p>
            <h3>{mode === 'intake' ? '0 files' : `${reviewItems.length} files`}</h3>
          </div>
        </div>

        {mode === 'intake' && <EmptyState message="Paste AI response to begin" />}

        {mode === 'review' && (
          <ul className="file-list">
            {reviewItems.map((item) => (
              <FileListItem
                key={item.id}
                file={item.file}
                lineCount={item.lineCount}
                language={item.language}
                mode={item.mode}
                status={item.status}
                validationError={item.validationError}
                isSelected={selectedItemId === item.id}
                onClick={() => onSelectItem(item.id)}
              />
            ))}
          </ul>
        )}
      </aside>

      <main className="main-panel">
        {mode === 'intake' && (
          <section className="intake-card">
            <header className="section-header">
              <div>
                <p className="eyebrow">AI Response Input</p>
                <h2>Paste the AI reply to parse code blocks</h2>
              </div>
            </header>

            {parseErrors.length > 0 && (
              <div className="error-banner">
                <strong>Parse Errors:</strong>
                <ul>
                  {parseErrors.map((error, idx) => (
                    <li key={idx}>{error}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="input-area">
              <textarea
                placeholder="Paste the AI response here. Must contain @inscribe BEGIN / END blocks."
                value={aiInput}
                onChange={(e) => onAiInputChange(e.target.value)}
              />
            </div>

            <footer className="intake-footer">
              <span className="char-count">{aiInput.length} characters</span>
              <Button
                variant="primary"
                type="button"
                onClick={onParseBlocks}
                disabled={!canParse || isParsingInProgress}
                title={!canParse ? 'Select a repository first' : isParsingInProgress ? 'Parsing in progress...' : ''}
              >
                {isParsingInProgress ? 'Parsing...' : 'Parse Code Blocks'}
              </Button>
            </footer>
          </section>
        )}

        {mode === 'review' && (
          <section className="review-panel">
            <div className="section-header">
              <div>
                <p className="eyebrow">Review & Apply</p>
                <h2>{selectedItem?.file || 'Select a file from the left'}</h2>
              </div>
              <Button
                variant="ghost"
                type="button"
                onClick={onToggleEditing}
                disabled={!selectedItem}
              >
                {isEditing ? 'Preview' : 'Edit'}
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
              {isEditing ? (
                <textarea
                  className="code-editor"
                  value={editorValue}
                  onChange={(e) => onEditorChange(e.target.value)}
                />
              ) : (
                <pre className="code-preview">
                  <code>{editorValue}</code>
                </pre>
              )}
            </div>

            <div className="action-bar">
              <button
                type="button"
                onClick={onUndo}
                title="Undo last apply (single-step)"
                disabled={isApplyingInProgress}
              >
                Undo last apply (single-step)
              </button>
              <button
                type="button"
                onClick={onRedo}
                disabled={!canRedo || isApplyingInProgress}
              >
                Redo Apply
              </button>
              <button type="button" onClick={onResetAll} disabled={isApplyingInProgress}>
                Reset All
              </button>
              <div className="action-spacer" />
              <Button
                variant="ghost"
                type="button"
                onClick={onApplySelected}
                disabled={!selectedItem || selectedItem.status === 'invalid' || isApplyingInProgress}
              >
                {isApplyingInProgress ? 'Applying...' : 'Apply Selected'}
              </Button>
              <Button
                variant="ghost"
                type="button"
                onClick={onApplyValidBlocks}
                disabled={validItemsCount === 0 || isApplyingInProgress}
              >
                {isApplyingInProgress ? 'Applying...' : 'Apply Valid Blocks'}
              </Button>
              <Button
                variant="primary"
                type="button"
                onClick={onApplyAll}
                disabled={reviewItems.some(item => item.status === 'invalid') || isApplyingInProgress}
              >
                {isApplyingInProgress ? 'Applying...' : 'Apply All Changes'}
              </Button>
            </div>

            <div className="status-banner">{statusMessage}</div>
          </section>
        )}
      </main>

      <aside className="right-rail">
        <button
          type="button"
          className="rail-btn"
          aria-label="View history"
          onClick={() => onStatusMessage('History (placeholder)')}
        >
          🕑
        </button>
        <button
          type="button"
          className="rail-btn"
          aria-label="Open settings"
          onClick={() => onStatusMessage('Settings (placeholder)')}
        >
          ⚙️
        </button>
        <button
          type="button"
          className="rail-btn"
          aria-label="Show information"
          onClick={() => onStatusMessage('Info (placeholder)')}
        >
          ℹ️
        </button>
      </aside>
    </div>
  );
}
