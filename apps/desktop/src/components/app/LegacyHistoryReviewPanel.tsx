import { ArrowLeft, RotateCcw } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { FileListEntry } from '@/components/common/FileListEntry';
import { useAppStateContext, useHistoryActions } from '@/hooks';
import { getLanguageFromFilename } from '@/utils';

const EMPTY_LEGACY_HISTORY_REVIEW = { applyId: null } as const;

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return Number.isNaN(date.valueOf()) ? timestamp : date.toLocaleString();
}

export function LegacyHistoryReviewPanel() {
  const { state, updateState } = useAppStateContext();
  const { restoreItem, restoreGroup } = useHistoryActions();
  const applyId = state.legacyHistoryReview.applyId;
  const reviewRef = useRef<HTMLElement>(null);
  const items = state.historyItems
    .filter((item) => item.applyId === applyId)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id));
  const restorableItems = items.filter((item) => !item.restoredAt);
  const firstItem = items[0];

  useEffect(() => {
    reviewRef.current?.focus({ preventScroll: true });
  }, [applyId]);

  const closeReview = () => {
    if (state.isRestoringInProgress) return;
    updateState({ legacyHistoryReview: EMPTY_LEGACY_HISTORY_REVIEW });
  };

  return (
    <section ref={reviewRef} tabIndex={-1} className="flex h-full min-h-0 flex-col bg-card outline-none">
      <header className="flex flex-shrink-0 items-center justify-between border-b border-border px-5 py-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Legacy History Review</p>
          <h1 className="truncate text-base font-semibold text-foreground">
            {items.length} historical file{items.length === 1 ? '' : 's'}
          </h1>
        </div>
        <Button variant="ghost" size="sm" type="button" onClick={closeReview} disabled={state.isRestoringInProgress}>
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
          Back to history
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-auto p-5">
        {firstItem && (
          <div className="mb-4 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
            <p className="font-medium text-foreground">
              Applied {formatTimestamp(firstItem.createdAt)}
            </p>
            <p className="mt-1 text-muted-foreground">
              Legacy history does not retain the live final-file data needed for a V2-style restore preview.
              The stored restore target is shown below; the legacy restore engine will perform its existing safety checks when you continue.
            </p>
          </div>
        )}

        <div className="space-y-3">
          {items.map((item) => {
            const targetContent = item.restoreOperation?.content ?? '';
            return (
              <article key={item.id} className="rounded-md border border-border p-3">
                <div className="flex items-start justify-between gap-3">
                  <FileListEntry
                    file={item.file}
                    lineCount={targetContent ? targetContent.split('\n').length : 0}
                    language={getLanguageFromFilename(item.file)}
                    mode={item.mode}
                    status={item.restoredAt ? 'applied' : 'pending'}
                  />
                  <div className="flex flex-shrink-0 items-center gap-2">
                    <span className="text-[10px] text-muted-foreground">
                      {item.restoredAt ? `Restored ${formatTimestamp(item.restoredAt)}` : 'Available'}
                    </span>
                    {!item.restoredAt && (
                      <Button
                        variant="outline"
                        size="sm"
                        type="button"
                        onClick={() => void restoreItem(item)}
                        disabled={state.isRestoringInProgress}
                      >
                        <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                        Restore file
                      </Button>
                    )}
                  </div>
                </div>
                <div className="mt-3">
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Stored restore target
                  </p>
                  <pre className="max-h-48 overflow-auto rounded border border-border bg-secondary/30 p-3 font-mono text-[11px] leading-relaxed text-foreground whitespace-pre-wrap">
                    {targetContent || '(empty file)'}
                  </pre>
                </div>
              </article>
            );
          })}
        </div>

        {restorableItems.length > 1 && (
          <div className="mt-4 flex justify-end">
            <Button
              type="button"
              onClick={() => void restoreGroup(applyId!)}
              disabled={state.isRestoringInProgress}
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Restore available files
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
