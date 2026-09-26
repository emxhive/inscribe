import { useMemo } from 'react';
import { FileCode2 } from 'lucide-react';
import {
  useAppStateContext,
  useHistoryActions,
} from '@/hooks';
import { cn } from '@/lib/utils';

export function HistoryRightPanel() {
  const { updateState } = useAppStateContext();

  return (
    <aside className="flex min-h-0 flex-col border-l border-border bg-card">
      <div className="flex h-10 flex-shrink-0 items-center justify-between border-b border-border px-3">
        <p className="text-xs font-semibold text-foreground">History</p>

        <button
          type="button"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          onClick={() => updateState({ rightPanelOwner: 'inspector' })}
          aria-label="Show inspector"
          title="Show inspector"
        >
          <FileCode2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3">
        <HistoryPanelContent />
      </div>
    </aside>
  );
}

function HistoryPanelContent() {
  const { state } = useAppStateContext();
  const { openRestoreReview } = useHistoryActions();

  const groupedHistory = useMemo(() => {
    const groups = new Map<string, typeof state.historyItems>();

    state.historyItems.forEach((item) => {
      const actionId = item.actionId ?? item.applyId;
      const group = groups.get(actionId) ?? [];
      group.push(item);
      groups.set(actionId, group);
    });

    return Array.from(groups.entries())
      .map(([actionId, items]) => ({
        actionId,
        items,
        createdAt: items[0]?.createdAt,
        actionType: items[0]?.actionType ?? 'apply',
      }))
      .sort((left, right) =>
        (right.createdAt ?? '').localeCompare(left.createdAt ?? ''),
      );
  }, [state.historyItems]);

  const formatTimestamp = (timestamp?: string) => {
    if (!timestamp) return 'Unknown time';

    const date = new Date(timestamp);

    return Number.isNaN(date.valueOf())
      ? timestamp
      : date.toLocaleString();
  };

  return (
    <div className="space-y-4 py-3">
      {groupedHistory.length === 0 && (
        <p className="py-3 text-xs text-muted-foreground">
          No history recorded yet.
        </p>
      )}

      {groupedHistory.map((group) => (
        <button
          key={group.actionId}
          type="button"
          className={cn(
            'w-full border-b border-border px-1 pb-3 text-left blue-tint-interactive',
            state.historyReview.actionId === group.actionId &&
              'blue-tint',
          )}
          onClick={() => void openRestoreReview(group.actionId)}
          disabled={
            state.isRestoringInProgress ||
            state.historyReview.isLoading ||
            state.historyReview.isRestoring
          }
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[10px] text-muted-foreground">
                {group.actionType === 'restore'
                  ? 'Restored'
                  : 'Applied'}{' '}
                {formatTimestamp(group.createdAt)}
              </p>

              <p className="text-xs font-semibold">
                {group.items.length} file
                {group.items.length === 1 ? '' : 's'}
              </p>
            </div>

            <span className="text-[10px] text-muted-foreground">
              Inspect
            </span>
          </div>

          <p className="mt-1 truncate text-[11px] text-muted-foreground">
            {group.items.map((item) => item.file).join(', ')}
          </p>

          {group.actionType === 'restore' &&
            group.items[0]?.sourceActionId && (
              <p className="mt-1 truncate text-[10px] text-primary/80">
                Reverses action {group.items[0].sourceActionId}
              </p>
            )}
        </button>
      ))}
    </div>
  );
}
