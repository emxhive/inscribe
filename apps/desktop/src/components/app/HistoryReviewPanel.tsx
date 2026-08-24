import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { buildUnifiedDiffModel } from '@/utils/reviewComparison';
import type { ReviewComparison } from '@/types';
import { UnifiedDiffView } from './ReviewPanel';
import { useAppStateContext } from '@/hooks';

/**
 * The history review canvas deliberately owns only the center region. The
 * workspace shell supplies the file rail, inspector, and workflow bar so a
 * historical restore reads like Review with a different source of data.
 */
export function HistoryReviewPanel() {
  const { state } = useAppStateContext();
  const preview = state.v2HistoryReview.preview;
  const reviewRef = useRef<HTMLElement>(null);
  const selectedEntryId = state.v2HistoryReview.selectedEntryId;
  const [selectedHunkId, setSelectedHunkId] = useState<string | null>(null);
  const [collapsedHunkIds, setCollapsedHunkIds] = useState<string[]>([]);
  const [collapsedDiffGroupIds, setCollapsedDiffGroupIds] = useState<string[]>([]);

  useEffect(() => {
    reviewRef.current?.focus({ preventScroll: true });
  }, [state.v2HistoryReview.actionId]);

  useEffect(() => {
    setSelectedHunkId(null);
    setCollapsedHunkIds([]);
    setCollapsedDiffGroupIds([]);
  }, [selectedEntryId]);

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

  return (
    <section ref={reviewRef} tabIndex={-1} className="flex h-full min-h-0 flex-col bg-background outline-none">
      <div className="flex h-10 flex-shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-3">
        <span className="min-w-0 truncate font-mono text-xs font-semibold text-foreground" title={selectedFile?.file}>
          {selectedFile?.file ?? 'History restore preview'}
        </span>
        <span className="flex-shrink-0 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Read-only · Current → proposed
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {state.v2HistoryReview.isLoading && (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Checking the current repository state...
          </div>
        )}

        {!state.v2HistoryReview.isLoading && state.v2HistoryReview.error && !preview && (
          <div className="flex h-full items-center justify-center p-6 text-sm text-destructive">
            <p className="max-w-xl rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3">
              {state.v2HistoryReview.error}
            </p>
          </div>
        )}

        {!state.v2HistoryReview.isLoading && !state.v2HistoryReview.error && !selectedFile && (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Select a historical file from the left pane.
          </div>
        )}

        {selectedFile?.restoredState && (
          <UnifiedDiffView
            model={diffModel}
            selectedHunkId={selectedHunkId}
            collapsedHunkIds={collapsedHunkIds}
            collapsedDiffGroupIds={collapsedDiffGroupIds}
            onSelectHunk={setSelectedHunkId}
            onToggleHunk={(hunkId) => setCollapsedHunkIds((current) => current.includes(hunkId)
              ? current.filter((id) => id !== hunkId)
              : [...current, hunkId])}
            onToggleGroup={(groupId) => setCollapsedDiffGroupIds((current) => current.includes(groupId)
              ? current.filter((id) => id !== groupId)
              : [...current, groupId])}
          />
        )}

        {selectedFile && !selectedFile.restoredState && (
          <div className="flex h-full items-center justify-center p-6 text-center">
            <div className="max-w-xl rounded-md border border-amber-500/30 bg-amber-500/5 px-5 py-4 text-sm">
              <div className="flex items-center justify-center gap-2 font-medium text-foreground">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                Restore preview unavailable
              </div>
              <p className="mt-2 text-muted-foreground">
                The repository no longer satisfies the exact state required to reverse this file safely.
              </p>
              {selectedFile.error && <p className="mt-2 text-xs text-destructive">{selectedFile.error}</p>}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
