import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ArrowLeft, CheckCircle2, Clock, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppStateContext, usePrimaryAction } from '@/hooks';
import { buildUnifiedDiffModel } from '@/utils/reviewComparison';
import { UnifiedDiffView } from './ReviewPanel';
import type { ReviewComparison } from '@/types';

const EMPTY_HISTORY_REVIEW = {
  actionId: null,
  requestId: null,
  preview: null,
  isLoading: false,
  isRestoring: false,
  error: null,
} as const;

function formatTimestamp(timestamp?: string): string {
  if (!timestamp) return 'Unknown time';
  const date = new Date(timestamp);
  return Number.isNaN(date.valueOf()) ? timestamp : date.toLocaleString();
}

export function HistoryReviewPanel() {
  const { state, updateState } = useAppStateContext();
  const primaryAction = usePrimaryAction();
  const preview = state.v2HistoryReview.preview;
  const reviewRef = useRef<HTMLElement>(null);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);

  useEffect(() => {
    reviewRef.current?.focus({ preventScroll: true });
  }, [state.v2HistoryReview.actionId]);

  useEffect(() => {
    const firstFile = preview?.files[0];
    setSelectedEntryId((current) =>
      current && preview?.files.some((file) => file.entryId === current)
        ? current
        : firstFile?.entryId ?? null,
    );
  }, [preview]);

  const selectedFile = preview?.files.find((file) => file.entryId === selectedEntryId) ?? null;
  const comparison = useMemo<ReviewComparison | null>(() => {
    if (!selectedFile?.restoredState) return null;
    return {
      type: 'v2_final_file',
      file: selectedFile.file,
      oldContent: selectedFile.currentContent,
      newContent: selectedFile.restoredState.content,
      replacementRegions: [],
      diffHunks: selectedFile.diffHunks ?? [],
      regions: [],
    };
  }, [selectedFile]);
  const diffModel = useMemo(
    () => (comparison ? buildUnifiedDiffModel(comparison) : null),
    [comparison],
  );

  const closeReview = () => {
    if (state.isRestoringInProgress || state.v2HistoryReview.isRestoring) return;
    updateState({ v2HistoryReview: EMPTY_HISTORY_REVIEW });
  };

  return (
    <section ref={reviewRef} tabIndex={-1} className="flex h-full min-h-0 flex-col bg-card outline-none">
      <header className="flex flex-shrink-0 items-center justify-between border-b border-border px-5 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>History Review</span>
            {preview?.actionType && <span>· {preview.actionType === 'restore' ? 'Restore action' : 'Apply action'}</span>}
          </div>
          <h1 className="truncate text-base font-semibold text-foreground">
            {preview?.actionType === 'restore' ? 'Review reversal' : 'Review restore'}
          </h1>
        </div>
        <Button variant="ghost" size="sm" type="button" onClick={closeReview} disabled={state.isRestoringInProgress || state.v2HistoryReview.isRestoring}>
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
          Back to history
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-auto p-5">
        {state.v2HistoryReview.isLoading && (
          <p className="text-sm text-muted-foreground">Checking the current repository state...</p>
        )}
        {state.v2HistoryReview.error && !preview && (
          <p className="text-sm text-destructive">{state.v2HistoryReview.error}</p>
        )}
        {preview && (
          <div className="space-y-4">
            <div className="rounded-md border border-border bg-secondary/20 p-3 text-xs">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground">
                <span className="inline-flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />{formatTimestamp(preview.createdAt)}</span>
                <span>{preview.files.length} affected file{preview.files.length === 1 ? '' : 's'}</span>
                {preview.sourceActionId && <span className="font-mono">Reverses action {preview.sourceActionId}</span>}
              </div>
              <p className="mt-2 text-foreground">
                This review describes what restoring the historical action would do to the repository now.
              </p>
            </div>

            <div className="grid min-h-[32rem] grid-cols-[15rem_minmax(0,1fr)] overflow-hidden rounded-md border border-border">
              <div className="min-h-0 overflow-y-auto border-r border-border bg-secondary/20 p-2">
                <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Files</p>
                <div className="space-y-1">
                  {preview.files.map((file) => (
                    <button
                      key={file.entryId}
                      type="button"
                      className={`w-full rounded px-2 py-2 text-left text-xs ${selectedFile?.entryId === file.entryId ? 'bg-primary/10 text-foreground' : 'text-muted-foreground hover:bg-secondary'}`}
                      onClick={() => setSelectedEntryId(file.entryId)}
                    >
                      <span className="flex items-center gap-1.5">
                        {file.eligible ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <AlertCircle className="h-3.5 w-3.5 text-destructive" />}
                        <span className="truncate font-mono" title={file.file}>{file.file}</span>
                      </span>
                      <span className="mt-1 block pl-5 text-[10px]">{file.eligible ? 'Eligible' : 'Unavailable'}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex min-h-0 flex-col">
                {selectedFile && (
                  <div className="flex-shrink-0 border-b border-border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-mono text-sm font-semibold">{selectedFile.file}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Current: {selectedFile.currentExists ? 'present' : 'absent'}
                          {' · '}
                          Proposed: {selectedFile.restoredState
                            ? selectedFile.restoredState.exists ? 'present' : 'absent'
                            : 'unavailable'}
                        </p>
                      </div>
                      <span className={`flex-shrink-0 text-xs font-medium ${selectedFile.eligible ? 'text-emerald-600' : 'text-destructive'}`}>
                        {selectedFile.eligible ? 'Eligible' : 'Unavailable'}
                      </span>
                    </div>
                    {selectedFile.error && <p className="mt-2 text-xs text-destructive">{selectedFile.error}</p>}
                    {selectedFile.sourceEntryId && (
                      <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                        Reverses historical entry {selectedFile.sourceEntryId}
                      </p>
                    )}
                  </div>
                )}
                {selectedFile?.restoredState && (
                  <div className="min-h-0 flex-1">
                    <UnifiedDiffView
                      model={diffModel}
                      selectedHunkId={null}
                      collapsedHunkIds={[]}
                      collapsedDiffGroupIds={[]}
                      onSelectHunk={() => undefined}
                      onToggleHunk={() => undefined}
                      onToggleGroup={() => undefined}
                    />
                  </div>
                )}
                {selectedFile && !selectedFile.restoredState && (
                  <div className="flex min-h-[20rem] items-center justify-center p-6 text-center text-sm text-muted-foreground">
                    The proposed restored state is unavailable because this action cannot be safely reversed.
                  </div>
                )}
              </div>
            </div>

            {preview.error && <p className="text-sm text-destructive">{preview.error}</p>}
            <div className="flex items-center justify-end gap-3">
              <Button variant="outline" type="button" onClick={closeReview} disabled={state.isRestoringInProgress || state.v2HistoryReview.isRestoring}>Cancel</Button>
              <Button type="button" onClick={primaryAction.run} disabled={!primaryAction.action.enabled}>
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                {state.v2HistoryReview.isRestoring ? 'Restoring...' : primaryAction.action.label}
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
