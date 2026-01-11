import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAppStateContext, useApplyActions, useReviewActions } from '@/hooks';
import { AlertCircle, Maximize2, Minimize2 } from 'lucide-react';

export function ReviewPanel() {
  const { state, updateState } = useAppStateContext();
  const reviewActions = useReviewActions();
  const applyActions = useApplyActions();
  const isMaximized = state.isReviewMaximized;

  const { selectedItem, editorValue, pendingItemsCount } = reviewActions;
  const hasInvalidItems = state.reviewItems.some((item) => item.status === 'invalid');

  const canApplySelected = selectedItem && selectedItem.status === 'pending' && !state.isApplyingInProgress;

  return (
    <section className="flex flex-col gap-3.5 h-full min-h-0 bg-card border border-border rounded-xl shadow-md p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Review & Apply</p>
          <h2 className="text-xl font-semibold mt-0.5">{selectedItem?.file || 'Select a file from the left'}</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            type="button"
            onClick={() => updateState({ isEditing: !state.isEditing })}
            disabled={!selectedItem}
          >
            {state.isEditing ? 'Preview' : 'Edit'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={() =>
              updateState((prev) => ({
                isReviewMaximized: !prev.isReviewMaximized,
                isIntakeMaximized: false,
              }))
            }
          >
            {isMaximized ? (
              <>
                <Minimize2 className="h-4 w-4 mr-2" />
                Restore
              </>
            ) : (
              <>
                <Maximize2 className="h-4 w-4 mr-2" />
                Maximize
              </>
            )}
          </Button>
        </div>
      </div>

      {selectedItem?.validationError && (
        <div className="bg-red-50 border border-red-200 text-red-900 px-4 py-3 rounded-md text-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <strong>Validation Error:</strong> {selectedItem.validationError}
          </div>
        </div>
      )}

      {selectedItem?.mode === 'range' && (
        <p className="text-xs text-muted-foreground bg-secondary px-2 py-1.5 rounded-lg border border-border self-start">
          Range anchors must match exactly and be unique; duplicates fail; no partial apply.
        </p>
      )}

      <div className="flex-1 min-h-[320px] border border-border rounded-lg p-3 bg-secondary flex">
        {state.isEditing ? (
          <textarea
            className="flex-1 w-full h-full border-none rounded-lg p-3.5 font-mono text-sm leading-relaxed bg-slate-900 text-slate-200 resize-none outline-none"
            value={editorValue}
            onChange={(e) => reviewActions.handleEditorChange(e.target.value)}
          />
        ) : (
          <pre className="flex-1 w-full h-full overflow-auto border-none rounded-lg p-3.5 font-mono text-sm leading-relaxed bg-slate-900 text-slate-200">
            <code>{editorValue}</code>
          </pre>
        )}
      </div>

      <div className="flex items-center gap-2.5 mt-1 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          type="button"
          onClick={applyActions.handleUndo}
          title="Undo last apply (single-step)"
          disabled={state.isApplyingInProgress}
        >
          Undo last apply
        </Button>
        <Button
          variant="outline"
          size="sm"
          type="button"
          onClick={applyActions.handleRedo}
          disabled={!state.canRedo || state.isApplyingInProgress}
        >
          Redo Apply
        </Button>
        <Button 
          variant="outline" 
          size="sm"
          type="button" 
          onClick={reviewActions.handleResetAll} 
          disabled={state.isApplyingInProgress}
        >
          Reset All
        </Button>
        <div className="flex-1" />
        <Button
          variant="outline"
          size="sm"
          type="button"
          onClick={applyActions.handleApplySelected}
          disabled={!canApplySelected}
        >
          {state.isApplyingInProgress ? 'Applying...' : 'Apply Selected'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          type="button"
          onClick={applyActions.handleApplyValidBlocks}
          disabled={pendingItemsCount === 0 || state.isApplyingInProgress}
        >
          {state.isApplyingInProgress ? 'Applying...' : 'Apply Valid Blocks'}
        </Button>
        <Button
          type="button"
          onClick={applyActions.handleApplyAll}
          disabled={hasInvalidItems || state.isApplyingInProgress}
        >
          {state.isApplyingInProgress ? 'Applying...' : 'Apply All Changes'}
        </Button>
      </div>

      {state.statusMessage && (
        <Badge variant="secondary" className="w-fit">{state.statusMessage}</Badge>
      )}
    </section>
  );
}
