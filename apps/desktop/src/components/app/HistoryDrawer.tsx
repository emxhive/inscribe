import React, { useMemo } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAppStateContext, useHistoryActions } from '@/hooks';

export function HistoryDrawer() {
  const { state, updateState } = useAppStateContext();
  const { restoreItem, restoreGroup } = useHistoryActions();

  const activeItems = state.historyItems.filter((item) => !item.restoredAt);
  const groupedHistory = useMemo(() => {
    const groups = new Map<string, typeof activeItems>();
    activeItems.forEach((item) => {
      const group = groups.get(item.applyId) ?? [];
      group.push(item);
      groups.set(item.applyId, group);
    });
    return Array.from(groups.entries()).map(([applyId, items]) => ({
      applyId,
      items,
      createdAt: items[0]?.createdAt,
    }));
  }, [activeItems]);

  const formatTimestamp = (timestamp?: string) => {
    if (!timestamp) return 'Unknown time';
    const date = new Date(timestamp);
    if (Number.isNaN(date.valueOf())) return timestamp;
    return date.toLocaleString();
  };

  return (
    <div
      className={[
        'absolute inset-y-0 right-16 z-20 w-[360px] bg-card border-l border-border shadow-lg transition-transform duration-200',
        state.isHistoryOpen ? 'translate-x-0' : 'translate-x-full pointer-events-none',
      ].join(' ')}
      aria-hidden={!state.isHistoryOpen}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div>
          <h2 className="text-sm font-semibold">History</h2>
          <p className="text-xs text-muted-foreground">
            {activeItems.length} block{activeItems.length === 1 ? '' : 's'} available to restore
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          type="button"
          onClick={() => updateState({ isHistoryOpen: false })}
          aria-label="Close history"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="h-full overflow-y-auto pb-6">
        {groupedHistory.length === 0 && (
          <div className="px-4 py-6 text-sm text-muted-foreground">
            No applied blocks to restore yet.
          </div>
        )}

        {groupedHistory.map((group) => (
          <div key={group.applyId} className="border-b border-border px-4 py-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Applied {formatTimestamp(group.createdAt)}</p>
                <p className="text-sm font-medium">
                  {group.items.length} block{group.items.length === 1 ? '' : 's'}
                </p>
              </div>
              {group.items.length > 1 && (
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => restoreGroup(group.applyId)}
                  disabled={state.isRestoringInProgress}
                >
                  Restore All
                </Button>
              )}
            </div>

            <div className="space-y-3">
              {group.items.map((item) => (
                <div key={item.id} className="rounded-lg border border-border bg-background/40 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{item.file}</p>
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="secondary" className="uppercase text-[10px]">
                          {item.mode}
                        </Badge>
                        {item.restoreStatus && item.restoreStatus !== 'idle' && item.restoreStatus !== 'restoring' && (
                          <span>{item.restoreStatus.replace('-', ' ')}</span>
                        )}
                      </div>
                      {item.restoreMessage && (
                        <p className="mt-2 text-xs text-muted-foreground">{item.restoreMessage}</p>
                      )}
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      type="button"
                      onClick={() => restoreItem(item)}
                      disabled={state.isRestoringInProgress || item.restoreStatus === 'restoring'}
                    >
                      {item.restoreStatus === 'restoring' ? 'Restoring...' : 'Restore'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
