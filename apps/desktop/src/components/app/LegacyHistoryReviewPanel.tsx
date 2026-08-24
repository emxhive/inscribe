import { useEffect, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useAppStateContext } from '@/hooks';

/**
 * Legacy history has no persisted final-file snapshot. Keep its inspection
 * surface in the shared center region, but label the stored target honestly
 * instead of presenting it as a live diff.
 */
export function LegacyHistoryReviewPanel() {
  const { state } = useAppStateContext();
  const applyId = state.legacyHistoryReview.applyId;
  const reviewRef = useRef<HTMLElement>(null);
  const items = state.historyItems
    .filter((item) => item.applyId === applyId)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id));
  const selectedItem = items.find((item) => item.id === state.legacyHistoryReview.selectedEntryId) ?? items[0] ?? null;

  useEffect(() => {
    reviewRef.current?.focus({ preventScroll: true });
  }, [applyId]);

  const targetContent = selectedItem?.restoreOperation?.content ?? '';

  return (
    <section ref={reviewRef} tabIndex={-1} className="flex h-full min-h-0 flex-col bg-background outline-none">
      <div className="flex h-10 flex-shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-3">
        <span className="min-w-0 truncate font-mono text-xs font-semibold text-foreground" title={selectedItem?.file}>
          {selectedItem?.file ?? 'Legacy history review'}
        </span>
        <span className="flex-shrink-0 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Read-only · Stored target
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-4">
        <div className="mx-auto flex max-w-4xl flex-col gap-4">
          <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm">
            <div className="flex items-center gap-2 font-medium text-foreground">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              Live restore preview unavailable
            </div>
            <p className="mt-2 text-muted-foreground">
              Legacy history does not retain the final-file data required to compare the repository now. The stored restore target is shown for inspection; existing legacy safety checks still run when you restore.
            </p>
          </div>

          {selectedItem && (
            <div className="min-h-0 rounded-md border border-border bg-card">
              <div className="border-b border-border px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Stored restore target
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  This is historical data, not a live current → proposed comparison.
                </p>
              </div>
              <pre className="max-h-[calc(100vh-15rem)] overflow-auto p-4 font-mono text-xs leading-relaxed text-foreground whitespace-pre-wrap">
                {targetContent || '(empty file)'}
              </pre>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
