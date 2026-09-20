import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, CircleDot, XCircle } from 'lucide-react';
import { EmptyState } from '../common';
import { useAppStateContext, useIntakeBlocks, useReviewActions } from '@/hooks';
import { cn } from '@/lib/utils';

function countChangedLines(text: string): number {
  if (!text) return 0;
  const withoutTrailingNewline = text.endsWith('\n') ? text.slice(0, -1) : text;
  return withoutTrailingNewline.length === 0 ? 1 : withoutTrailingNewline.split('\n').length;
}

export const MIN_SIDEBAR_WIDTH = 240;
export const MAX_SIDEBAR_WIDTH = 420;

const intakeStatusConfig = {
  valid: { icon: CheckCircle2, className: 'text-emerald-600', label: 'valid' },
  warning: { icon: AlertTriangle, className: 'text-amber-600', label: 'warning' },
  error: { icon: XCircle, className: 'text-destructive', label: 'error' },
  incomplete: { icon: CircleDot, className: 'text-amber-500 animate-pulse', label: 'incomplete' },
} as const;

type FileSidebarProps = {
  sidebarWidth: number;
  onResize: (width: number, options?: { persist?: boolean }) => void;
};

export function FileSidebar({ sidebarWidth, onResize }: FileSidebarProps) {
  const { state, updateState } = useAppStateContext();
  const { handleSelectReviewFile } = useReviewActions();
  const { blocks } = useIntakeBlocks();
  const [dragging, setDragging] = useState(false);
  const sidebarRef = useRef<HTMLElement | null>(null);
  const invalidBlockCount = blocks.filter((block) => block.status === 'error' || block.status === 'incomplete').length;
  const intakeIssueCount = blocks.reduce((sum, block) => sum + new Set([...block.errors, ...block.warnings]).size, 0);
  const isHistoryReviewActive = Boolean(state.historyReview.actionId);
  const historyFiles = state.historyReview.preview?.files ?? [];

  useEffect(() => {
    if (state.mode !== 'intake') return;
    if (blocks.length === 0 && state.selectedIntakeBlockId !== null) {
      updateState({ selectedIntakeBlockId: null, selectedIntakeLineIndex: null });
      return;
    }
    if (blocks.length > 0 && !blocks.some((block) => block.id === state.selectedIntakeBlockId)) {
      updateState({ selectedIntakeBlockId: blocks[0].id, selectedIntakeLineIndex: null });
    }
  }, [blocks, state.mode, state.selectedIntakeBlockId, updateState]);

  useEffect(() => {
    if (!dragging) return;
    const handleMouseMove = (event: MouseEvent) => {
      if (!sidebarRef.current) return;
      const nextWidth = Math.min(
        MAX_SIDEBAR_WIDTH,
        Math.max(MIN_SIDEBAR_WIDTH, event.clientX - sidebarRef.current.getBoundingClientRect().left),
      );
      onResize(nextWidth);
    };
    const handleMouseUp = () => {
      setDragging(false);
      onResize(sidebarWidth, { persist: true });
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, onResize, sidebarWidth]);

  const renderIntakeStatus = (status: keyof typeof intakeStatusConfig) => {
    const config = intakeStatusConfig[status];
    const Icon = config.icon;
    return <Icon className={cn('h-3 w-3 flex-shrink-0', config.className)} aria-label={config.label} />;
  };

  return (
    <aside ref={sidebarRef} className="relative flex min-h-0 flex-col border-r border-border bg-card" style={{ width: sidebarWidth }}>
      <div className="flex h-10 items-center justify-between border-b border-border px-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {isHistoryReviewActive ? 'History Review' : state.mode === 'intake' ? 'Blocks' : 'Changes'}
        </span>
        <div className="flex items-center gap-2 text-xs font-semibold">
          {state.mode === 'intake' && intakeIssueCount > 0 && (
            <span className={cn(
              'whitespace-nowrap rounded-full px-1.5 py-0.5 text-[10px]',
              invalidBlockCount > 0 ? 'bg-destructive/10 text-destructive' : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
            )}>
              {invalidBlockCount} invalid · {intakeIssueCount} issue{intakeIssueCount === 1 ? '' : 's'}
            </span>
          )}
          <span className="text-foreground">
            {isHistoryReviewActive ? historyFiles.length : state.mode === 'intake' ? blocks.length : state.reviewFiles.length}
          </span>
        </div>
      </div>

      {isHistoryReviewActive && (
        historyFiles.length === 0 ? (
          <div className="p-3 text-xs text-muted-foreground">
            {state.historyReview.isLoading ? 'Checking historical files...' : 'No historical files available.'}
          </div>
        ) : (
          <ul className="m-0 flex min-h-0 flex-1 list-none flex-col overflow-y-auto overflow-x-hidden p-0">
            {historyFiles.map((file) => {
              const fileName = file.file.split(/[\\/]/).filter(Boolean).pop() ?? file.file;
              const isSelected = state.historyReview.selectedEntryId === file.entryId;
              const StatusIcon = file.eligible ? CheckCircle2 : XCircle;
              return (
                <li key={file.entryId} className="border-b border-border">
                  <button
                    type="button"
                    onClick={() => updateState({ historyReview: { ...state.historyReview, selectedEntryId: file.entryId } })}
                    className={cn('w-full px-3 py-2 text-left transition-colors', isSelected ? 'bg-primary/10' : 'hover:bg-secondary/70')}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <StatusIcon className={cn('h-3.5 w-3.5 flex-shrink-0', file.eligible ? 'text-emerald-600' : 'text-destructive')} />
                      <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground" title={file.file}>{fileName}</span>
                    </div>
                    <div className="mt-1 pl-5 text-[10px] text-muted-foreground">
                      {file.eligible ? 'Eligible to restore' : 'Unavailable'}
                      {file.currentExists !== (file.restoredState?.exists ?? file.currentExists) && ' · state changes'}
                    </div>
                    {!file.eligible && file.error && <p className="mt-0.5 truncate pl-5 text-[10px] text-destructive" title={file.error}>{file.error}</p>}
                  </button>
                </li>
              );
            })}
          </ul>
        )
      )}

      {!isHistoryReviewActive && state.mode === 'intake' && blocks.length === 0 && <div className="p-3"><EmptyState message="Paste AI response to begin" /></div>}

      {!isHistoryReviewActive && state.mode === 'intake' && blocks.length > 0 && (
        <ul className="m-0 flex min-h-0 flex-1 list-none flex-col overflow-y-auto p-0">
          {blocks.map((block) => {
            const issueCount = new Set([...block.errors, ...block.warnings]).size;
            return (
              <li key={block.id}>
                <button
                  type="button"
                  onClick={() => updateState({ selectedIntakeBlockId: block.id, selectedIntakeLineIndex: null, rightPanelOwner: 'inspector' })}
                  className={cn(
                    'w-full border-b border-border px-3 py-2 text-left transition',
                    block.status === 'error' && 'border-l-2 border-l-destructive',
                    block.status === 'incomplete' && 'border-l-2 border-l-amber-500',
                    block.id === state.selectedIntakeBlockId ? 'bg-primary/10' : 'hover:bg-secondary/70',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {block.mode && <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-medium lowercase text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">{block.mode}</span>}
                      </div>
                      <span className="mt-1 block truncate text-xs font-medium text-foreground" title={block.label}>{block.label}</span>
                      {block.mode === 'replace_node' && block.selectorText && <div className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground" title={block.selectorText}>{block.selectorText}</div>}
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-1.5">
                      {issueCount > 0 && <span className={cn('rounded-full px-1.5 py-0.5 text-[9px] font-semibold', block.status === 'error' ? 'bg-destructive/10 text-destructive' : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300')}>{issueCount}</span>}
                      {renderIntakeStatus(block.status)}
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Lines {block.startLine + 1}–{block.endLine + 1}</p>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {!isHistoryReviewActive && state.mode === 'review' && (
        <ul className="m-0 flex min-h-0 flex-1 list-none flex-col overflow-y-auto overflow-x-hidden p-0">
          {state.reviewFiles.map((file) => {
            const fileName = file.filePath.split('/').pop() ?? file.filePath;
            const parentPath = file.filePath.slice(0, -(fileName.length + 1));
            const operations = state.reviewItems.filter((item) => file.operationIds.includes(item.id));
            const sidebarStatus = operations.length > 0 && operations.every((item) => item.status === 'applied') ? 'applied' : 'pending';
            const StatusIcon = sidebarStatus === 'applied' ? CheckCircle2 : CircleDot;
            return (
              <li key={file.id} className="border-b border-border">
                <button type="button" onClick={() => handleSelectReviewFile(file.id)} className={cn('w-full px-3 py-2 text-left transition-colors', state.selectedReviewFileId === file.id ? 'bg-primary/10' : 'hover:bg-secondary/70')}>
                  <div className="flex min-w-0 items-center gap-2">
                    <StatusIcon className={cn('h-3.5 w-3.5 flex-shrink-0', sidebarStatus === 'applied' ? 'text-emerald-600' : 'text-muted-foreground')} />
                    <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground" title={file.filePath}>{fileName}</span>
                    <div className="flex flex-shrink-0 items-center gap-1.5 font-mono text-[10px] font-semibold">
                      <span className="text-emerald-700 dark:text-emerald-400">+{file.comparison.diffHunks?.reduce((sum, hunk) => sum + countChangedLines(hunk.newText), 0) ?? 0}</span>
                      <span className="text-destructive">−{file.comparison.diffHunks?.reduce((sum, hunk) => sum + countChangedLines(hunk.oldText), 0) ?? 0}</span>
                    </div>
                  </div>
                  <div className="mt-0.5 flex min-w-0 items-center gap-1.5 pl-5 text-[10px] text-muted-foreground">
                    {parentPath && <span className="min-w-0 flex-1 truncate font-mono" title={parentPath}>{parentPath}</span>}
                    {parentPath && <span aria-hidden>·</span>}
                    <span className="flex-shrink-0">{operations.length} operation{operations.length === 1 ? '' : 's'}</span>
                    {operations.some((item) => item.targetScope.matchMetadata?.kind === 'fallback') && <span className="flex-shrink-0 text-amber-600 dark:text-amber-400">· fallback</span>}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <button type="button" aria-label="Resize sidebar" onMouseDown={() => setDragging(true)} className={cn('absolute right-0 top-0 h-full w-1.5 cursor-col-resize', dragging ? 'bg-primary/20' : 'hover:bg-border')} />
    </aside>
  );
}
