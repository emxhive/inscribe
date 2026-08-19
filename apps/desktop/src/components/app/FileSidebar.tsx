import React, { useEffect, useRef, useState } from 'react';
import { EmptyState } from '../common';
import { useAppStateContext, useReviewActions, useIntakeBlocks } from '@/hooks';
import { cn } from '@/lib/utils';
import type { ReviewItem } from '@/types';
import { ReviewDirectivePopover } from './ReviewDirectivePopover';
import { AlertTriangle, CheckCircle2, XCircle, CircleDot } from 'lucide-react';
import { getReviewSidebarError, getReviewSidebarStatus } from '@/utils';

export const MIN_SIDEBAR_WIDTH = 240;
export const MAX_SIDEBAR_WIDTH = 420;

const intakeStatusConfig = {
  valid: {
    icon: CheckCircle2,
    className: 'text-emerald-600',
    label: 'valid',
  },
  warning: {
    icon: AlertTriangle,
    className: 'text-amber-600',
    label: 'warning',
  },
  error: {
    icon: XCircle,
    className: 'text-destructive',
    label: 'error',
  },
  incomplete: {
    icon: CircleDot,
    className: 'text-amber-500 animate-pulse',
    label: 'incomplete',
  },
} as const;

type FileSidebarProps = {
  sidebarWidth: number;
  onResize: (width: number, options?: { persist?: boolean }) => void;
};

export function FileSidebar({ sidebarWidth, onResize }: FileSidebarProps) {
  const { state, updateState } = useAppStateContext();
  const { handleSelectItem, handleUpdateDirectives } = useReviewActions();
  const { blocks } = useIntakeBlocks();
  const invalidBlockCount = blocks.filter((block) => block.status === 'error' || block.status === 'incomplete').length;
  const intakeIssueCount = blocks.reduce(
    (sum, block) => sum + new Set([...block.errors, ...block.warnings]).size,
    0,
  );
  const [dragging, setDragging] = useState(false);
  const sidebarRef = useRef<HTMLElement | null>(null);
  const directiveAnchorRef = useRef<HTMLElement | null>(null);
  const [directiveEditorItemId, setDirectiveEditorItemId] = useState<string | null>(null);

  useEffect(() => {
    if (state.mode !== 'intake') {
      return;
    }
    if (blocks.length === 0 && state.selectedIntakeBlockId !== null) {
      updateState({ selectedIntakeBlockId: null, selectedIntakeLineIndex: null });
      return;
    }
    const hasSelectedBlock = blocks.some((block) => block.id === state.selectedIntakeBlockId);
    if (blocks.length > 0 && !hasSelectedBlock) {
      updateState({ selectedIntakeBlockId: blocks[0].id, selectedIntakeLineIndex: null });
    }
  }, [blocks, state.mode, state.selectedIntakeBlockId, updateState]);

  useEffect(() => {
    if (!dragging) {
      return;
    }
    const handleMouseMove = (event: MouseEvent) => {
      if (!sidebarRef.current) {
        return;
      }
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

  const handleOpenDirectiveEditor = (
    item: ReviewItem,
    event: React.MouseEvent<HTMLLIElement>,
  ) => {
    if (item.status === 'applied' || item.engineVersion === 'v2') {
      return;
    }
    event.stopPropagation();
    directiveAnchorRef.current = event.currentTarget;
    setDirectiveEditorItemId(item.id);
  };

  const renderIntakeStatus = (status: keyof typeof intakeStatusConfig) => {
    const statusConfig = intakeStatusConfig[status];
    const Icon = statusConfig.icon;
    return (
      <span
        className="inline-flex items-center text-xs font-medium capitalize"
        title={statusConfig.label}
        aria-label={statusConfig.label}
      >
        <Icon className={cn('h-3 w-3 flex-shrink-0', statusConfig.className)} aria-hidden />
      </span>
    );
  };

  const reviewPathsByBasename = new Map<string, Set<string>>();
  state.reviewItems.forEach((item) => {
    const fileName = item.file.split('/').pop() ?? item.file;
    const paths = reviewPathsByBasename.get(fileName) ?? new Set<string>();
    paths.add(item.file);
    reviewPathsByBasename.set(fileName, paths);
  });

  return (
    <aside
      ref={sidebarRef}
      className="relative flex flex-col bg-card border-r border-border min-h-0"
      style={{ width: sidebarWidth }}
    >
      <div className="h-10 flex items-center justify-between border-b border-border px-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {state.mode === 'intake' ? 'Blocks' : 'Changes'}
        </span>
        <div className="flex items-center gap-2 text-xs font-semibold">
          {state.mode === 'intake' && intakeIssueCount > 0 && (
            <span
              className={cn(
                'whitespace-nowrap rounded-full px-1.5 py-0.5 text-[10px]',
                invalidBlockCount > 0
                  ? 'bg-destructive/10 text-destructive'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
              )}
              title={`${invalidBlockCount} invalid blocks, ${intakeIssueCount} intake issues`}
            >
              {invalidBlockCount} invalid · {intakeIssueCount} issue{intakeIssueCount === 1 ? '' : 's'}
            </span>
          )}
          <span className="text-foreground">
            {state.mode === 'intake' ? blocks.length : state.reviewItems.length}
          </span>
        </div>
      </div>

      {state.mode === 'intake' && blocks.length === 0 && (
        <div className="p-3">
          <EmptyState message="Paste AI response to begin" />
        </div>
      )}

      {state.mode === 'intake' && blocks.length > 0 && (
        <div className="flex flex-col min-h-0 flex-1">
          <ul className="flex-1 min-h-0 overflow-y-auto list-none p-0 m-0">
            {blocks.map((block) => {
              const isV2 = block.protocol === 'v2';
              const issueCount = new Set([...block.errors, ...block.warnings]).size;
              const firstIssue = block.errors[0] ?? block.warnings[0];
              const riskLabels: Record<string, string> = {
                delete_file: 'delete',
                replace_file: 'whole file',
                replace_node: 'structural',
                replace_text: 'text',
                create_file: 'create',
              };

              if (isV2) {
                return (
                  <li key={block.id}>
                    <button
                      type="button"
                      onClick={() => updateState({
                        selectedIntakeBlockId: block.id,
                        selectedIntakeLineIndex: null,
                        rightPanelOwner: 'inspector',
                      })}
                      className={cn(
                        'w-full border-b border-border px-3 py-2 text-left transition',
                        block.status === 'error' && 'border-l-2 border-l-destructive',
                        block.status === 'incomplete' && 'border-l-2 border-l-amber-500',
                        block.id === state.selectedIntakeBlockId
                          ? 'bg-primary/10'
                          : 'hover:bg-secondary/70',
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-col min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="rounded bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 text-[10px] font-bold px-1.5 py-0.5 uppercase">V2</span>
                            {block.mode && (
                              <span className="rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 text-[10px] font-medium px-1.5 py-0.5 lowercase">
                                {block.mode}
                              </span>
                            )}
                            {block.mode && riskLabels[block.mode] && (
                              <span className="text-[10px] text-muted-foreground bg-secondary px-1 py-0.5 rounded font-medium">
                                {riskLabels[block.mode]}
                              </span>
                            )}
                          </div>
                          <span className="mt-1 block truncate text-xs font-medium text-foreground" title={block.label}>
                            {block.label}
                          </span>
                          {block.mode === 'replace_node' && block.selectorText && (
                            <div className="text-[10px] font-mono text-muted-foreground mt-0.5 truncate" title={block.selectorText}>
                              {block.selectorText}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-shrink-0 items-center gap-1.5">
                          {issueCount > 0 && (
                            <span className={cn(
                              'rounded-full px-1.5 py-0.5 text-[9px] font-semibold',
                              block.status === 'error'
                                ? 'bg-destructive/10 text-destructive'
                                : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
                            )}>
                              {issueCount}
                            </span>
                          )}
                          {renderIntakeStatus(block.status)}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Lines {block.startLine + 1}–{block.endLine + 1}
                      </p>
                      {firstIssue && (
                        <p className={cn(
                          'mt-1 truncate text-[10px] leading-snug',
                          block.status === 'error' ? 'text-destructive/90' : 'text-amber-700 dark:text-amber-300',
                        )} title={firstIssue}>
                          {firstIssue}
                        </p>
                      )}
                    </button>
                  </li>
                );
              }

              return (
                <li key={block.id}>
                  <button
                    type="button"
                    onClick={() => updateState({
                      selectedIntakeBlockId: block.id,
                      selectedIntakeLineIndex: null,
                      rightPanelOwner: 'inspector',
                    })}
                    className={cn(
                      'w-full text-left border-b border-border px-3 py-2 transition',
                      block.id === state.selectedIntakeBlockId
                        ? 'bg-primary/10'
                        : 'hover:bg-secondary/70',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-medium text-foreground">{block.label}</span>
                      {renderIntakeStatus(block.status)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Lines {block.startLine + 1}–{block.endLine + 1}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {state.mode === 'review' && (
        <>
          <ul className="flex flex-col overflow-y-auto overflow-x-hidden list-none p-0 m-0 flex-1 min-h-0">
            {state.reviewItems.map((item) => {
              const comparison = state.reviewComparisonByItem[item.id]?.comparison;
              const diffHunks = comparison?.diffHunks ?? [];
              const countChangedLines = (text: string) => {
                if (!text) return 0;
                const withoutTrailingNewline = text.endsWith('\n') ? text.slice(0, -1) : text;
                return withoutTrailingNewline.length === 0 ? 1 : withoutTrailingNewline.split('\n').length;
              };
              const addedCount = diffHunks.reduce((sum, hunk) => sum + countChangedLines(hunk.newText), 0);
              const removedCount = diffHunks.reduce((sum, hunk) => sum + countChangedLines(hunk.oldText), 0);
              const sidebarStatus = getReviewSidebarStatus(item, state.reviewPreflightByItem);
              const sidebarError = getReviewSidebarError(item, state.reviewPreflightByItem);
              const StatusIcon = sidebarStatus === 'applied'
                ? CheckCircle2
                : sidebarStatus === 'invalid'
                  ? XCircle
                  : CircleDot;
              const pathParts = item.file.split('/');
              const fileName = pathParts.pop() ?? item.file;
              const parentPath = pathParts.join('/');
              const showParentPath = (reviewPathsByBasename.get(fileName)?.size ?? 0) > 1;
              const mode = item.engineVersion === 'v2' ? item.strategy : item.mode;
              const targetLabel = item.engineVersion === 'v2'
                ? item.targetScope.selectorText
                  ?? (item.targetScope.lineRange
                    ? `Lines ${item.targetScope.lineRange.startLine}–${item.targetScope.lineRange.endLine}`
                    : null)
                : null;
              const matchMetadata = item.engineVersion === 'v2' ? item.targetScope.matchMetadata : undefined;

              return (
                <li
                  key={item.id}
                  onDoubleClick={(event) => handleOpenDirectiveEditor(item, event)}
                  className="border-b border-border"
                >
                  <button
                    type="button"
                    onClick={() => handleSelectItem(item.id)}
                    className={cn(
                      'w-full px-3 py-2 text-left transition-colors',
                      state.selectedItemId === item.id
                        ? 'bg-primary/10'
                        : 'hover:bg-secondary/70',
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <StatusIcon
                        className={cn(
                          'h-3.5 w-3.5 flex-shrink-0',
                          sidebarStatus === 'applied'
                            ? 'text-emerald-600'
                            : sidebarStatus === 'invalid'
                              ? 'text-destructive'
                              : 'text-muted-foreground',
                        )}
                        aria-label={sidebarStatus}
                      />

                      <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground" title={item.file}>
                        {fileName}
                      </span>

                      <div className="flex flex-shrink-0 items-center gap-1.5 font-mono text-[10px] font-semibold">
                        <span className="text-emerald-700 dark:text-emerald-400">+{addedCount}</span>
                        <span className="text-destructive">−{removedCount}</span>
                      </div>
                    </div>

                    <div className="mt-0.5 flex min-w-0 items-center gap-1.5 pl-5 text-[10px] text-muted-foreground">
                      {showParentPath && parentPath && (
                        <>
                          <span className="max-w-[7rem] flex-shrink truncate font-mono" title={parentPath}>
                            {parentPath}
                          </span>
                          <span aria-hidden>·</span>
                        </>
                      )}
                      <span className="flex-shrink-0 font-medium text-foreground/80">{mode}</span>
                      <span aria-hidden>·</span>
                      <span className="flex-shrink-0">
                        {diffHunks.length} hunk{diffHunks.length === 1 ? '' : 's'}
                      </span>
                      {targetLabel && (
                        <>
                          <span aria-hidden>·</span>
                          <span className="min-w-0 flex-1 truncate font-mono" title={targetLabel}>
                            {targetLabel}
                          </span>
                        </>
                      )}
                      {matchMetadata?.kind === 'fallback' && (
                        <>
                          <span aria-hidden>·</span>
                          <span
                            className="flex-shrink-0 text-[9px] text-amber-600 dark:text-amber-400"
                            title={matchMetadata.fallbackReason}
                          >
                            fallback {Math.round((matchMetadata.score ?? 0) * 100)}%
                          </span>
                        </>
                      )}
                    </div>

                    {sidebarError && (
                      <p className="mt-0.5 truncate pl-5 text-[10px] leading-snug text-destructive" title={sidebarError}>
                        {sidebarError}
                      </p>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          <ReviewDirectivePopover
            isOpen={Boolean(directiveEditorItemId)}
            anchorRef={directiveAnchorRef}
            item={state.reviewItems.find((item) => item.id === directiveEditorItemId) ?? null}
            onClose={() => setDirectiveEditorItemId(null)}
            onSave={async (updates) => {
              if (!directiveEditorItemId) {
                return;
              }
              setDirectiveEditorItemId(null);
              await handleUpdateDirectives(directiveEditorItemId, updates);
            }}
          />
        </>
      )}
      <button
        type="button"
        aria-label="Resize sidebar"
        onMouseDown={() => setDragging(true)}
        className={cn(
          'absolute top-0 right-0 h-full w-1.5 cursor-col-resize',
          dragging ? 'bg-primary/20' : 'hover:bg-border',
        )}
      />
    </aside>
  );
}
