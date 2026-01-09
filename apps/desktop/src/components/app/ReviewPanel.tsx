import React, { useMemo } from 'react';
import { Button } from '../common';
import { useAppStateContext, useApplyActions, useReviewActions } from '../../hooks';

export function ReviewPanel() {
  const { state, updateState } = useAppStateContext();
  const reviewActions = useReviewActions();
  const applyActions = useApplyActions();

  const { selectedItem, editorValue, validItemsCount } = reviewActions;
  const hasInvalidItems = useMemo(
    () => state.reviewItems.some((item) => item.status === 'invalid'),
    [state.reviewItems]
  );

  const canApplySelected = selectedItem && selectedItem.status !== 'invalid' && !state.isApplyingInProgress;

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
          onClick={() => updateState({ isEditing: !state.isEditing })}
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
            onChange={(e) => reviewActions.handleEditorChange(e.target.value)}
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
          onClick={applyActions.handleUndo}
          title="Undo last apply (single-step)"
          disabled={state.isApplyingInProgress}
        >
          Undo last apply (single-step)
        </button>
        <button
          type="button"
          onClick={applyActions.handleRedo}
          disabled={!state.canRedo || state.isApplyingInProgress}
        >
          Redo Apply
        </button>
        <button type="button" onClick={reviewActions.handleResetAll} disabled={state.isApplyingInProgress}>
          Reset All
        </button>
        <div className="action-spacer" />
        <Button
          variant="ghost"
          type="button"
          onClick={applyActions.handleApplySelected}
          disabled={!canApplySelected}
        >
          {state.isApplyingInProgress ? 'Applying...' : 'Apply Selected'}
        </Button>
        <Button
          variant="ghost"
          type="button"
          onClick={applyActions.handleApplyValidBlocks}
          disabled={validItemsCount === 0 || state.isApplyingInProgress}
        >
          {state.isApplyingInProgress ? 'Applying...' : 'Apply Valid Blocks'}
        </Button>
        <Button
          variant="primary"
          type="button"
          onClick={applyActions.handleApplyAll}
          disabled={hasInvalidItems || state.isApplyingInProgress}
        >
          {state.isApplyingInProgress ? 'Applying...' : 'Apply All Changes'}
        </Button>
      </div>

      <div className="status-banner">{state.statusMessage}</div>
    </section>
  );
}
