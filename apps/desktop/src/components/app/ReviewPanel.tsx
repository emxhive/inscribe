import React from 'react';
import { Button } from '../common';
import type { ReviewItem } from '../../types';

interface ReviewPanelProps {
  selectedItem?: ReviewItem;
  isEditing: boolean;
  editorValue: string;
  isApplyingInProgress: boolean;
  canRedo: boolean;
  statusMessage: string;
  validItemsCount: number;
  hasInvalidItems: boolean;
  onToggleEditing: () => void;
  onEditorChange: (value: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onResetAll: () => void;
  onApplySelected: () => void;
  onApplyValidBlocks: () => void;
  onApplyAll: () => void;
  onStatusMessage: (value: string) => void;
}

export function ReviewPanel({
  selectedItem,
  isEditing,
  editorValue,
  isApplyingInProgress,
  canRedo,
  statusMessage,
  validItemsCount,
  hasInvalidItems,
  onToggleEditing,
  onEditorChange,
  onUndo,
  onRedo,
  onResetAll,
  onApplySelected,
  onApplyValidBlocks,
  onApplyAll,
  onStatusMessage,
}: ReviewPanelProps) {
  const canApplySelected = selectedItem && selectedItem.status !== 'invalid' && !isApplyingInProgress;

  return (
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
          disabled={!canApplySelected}
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
          disabled={hasInvalidItems || isApplyingInProgress}
        >
          {isApplyingInProgress ? 'Applying...' : 'Apply All Changes'}
        </Button>
      </div>

      <div className="status-banner">{statusMessage}</div>
    </section>
  );
}
