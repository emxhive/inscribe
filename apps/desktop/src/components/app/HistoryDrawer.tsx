import React, { useMemo } from 'react';
import { RotateCcw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileListEntry } from '@/components/common/FileListEntry';
import { useAppStateContext, useHistoryActions } from '@/hooks';
import { getLanguageFromFilename } from '@/utils';

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
    <div className="absolute inset-y-0 right-16 z-20 w-[360px] pointer-events-none">
      <div
        className={[
          'h-full bg-card border-l border-border shadow-lg transform-gpu will-change-transform pointer-events-auto',
          'transition-transform duration-[260ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none',
          state.isHistoryOpen ? 'translate-x-0' : 'translate-x-[calc(100%+4rem)]',
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
            <div className="px-4 py-6 text-sm text-muted-foreground">No applied blocks to restore yet.</div>
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
                    variant="ghost"
                    size="sm"
                    type="button"
                    onClick={() => restoreGroup(group.applyId)}
                    disabled={state.isRestoringInProgress}
                    className="gap-2 text-muted-foreground hover:text-foreground"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">Restore all</span>
                  </Button>
                )}
              </div>

              <div className="space-y-2">
                {group.items.map((item) => {
                  const restoreMeta = item.restoreMeta ?? {
                    file: item.restoreOperation?.file ?? item.file,
                    lineCount: item.restoreOperation?.content
                      ? item.restoreOperation.content.split('\n').length
                      : 0,
                    language: getLanguageFromFilename(item.restoreOperation?.file ?? item.file),
                    mode: item.restoreOperation?.type ?? item.mode ?? 'range',
                  };
                  return (
                    <FileListEntry
                      key={item.id}
                      file={restoreMeta.file}
                      lineCount={restoreMeta.lineCount}
                      language={restoreMeta.language}
                      mode={restoreMeta.mode}
                      status="applied"
                      actions={
                        <Button
                          variant="ghost"
                          size="icon"
                          type="button"
                          className="h-6 w-6 text-muted-foreground hover:text-foreground"
                          onClick={() => restoreItem(item)}
                          disabled={state.isRestoringInProgress}
                          aria-label={`Restore ${restoreMeta.file}`}
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                      }
                      actionPlacement="top"
                    />
                  );
                })}
              </div>

              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-[11px]">
                  {group.applyId}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
