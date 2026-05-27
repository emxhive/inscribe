import React, { useEffect, useRef, useState } from 'react';
import { EmptyState, FileListEntry } from '../common';
import { useAppStateContext, useReviewActions, useIntakeBlocks } from '@/hooks';
import { cn } from '@/lib/utils';
import type { ReviewItem } from '@/types';
import { ReviewDirectivePopover } from './ReviewDirectivePopover';
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
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
} as const;

type FileSidebarProps = {
  sidebarWidth: number;
  onResize: (width: number, options?: { persist?: boolean }) => void;
};

export function FileSidebar({ sidebarWidth, onResize }: FileSidebarProps) {
  const { state, updateState } = useAppStateContext();
  const { handleSelectItem, handleUpdateDirectives } = useReviewActions();
  const { blocks } = useIntakeBlocks();
  const [dragging, setDragging] = useState(false);
  const sidebarRef = useRef<HTMLElement | null>(null);
  const directiveAnchorRef = useRef<HTMLElement | null>(null);
  const [directiveEditorItemId, setDirectiveEditorItemId] = useState<string | null>(null);

  useEffect(() => {
    if (state.mode !== 'intake') {
      return;
    }
    if (blocks.length === 0 && state.selectedIntakeBlockId !== null) {
      updateState({ selectedIntakeBlockId: null });
      return;
    }
    const hasSelectedBlock = blocks.some((block) => block.id === state.selectedIntakeBlockId);
    if (blocks.length > 0 && !hasSelectedBlock) {
      updateState({ selectedIntakeBlockId: blocks[0].id });
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
    if (item.status === 'applied') {
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
        <span className="text-xs font-semibold text-foreground">
          {state.mode === 'intake' ? blocks.length : state.reviewItems.length}
        </span>
      </div>

      {state.mode === 'intake' && blocks.length === 0 && (
        <div className="p-3">
          <EmptyState message="Paste AI response to begin" />
        </div>
      )}

      {state.mode === 'intake' && blocks.length > 0 && (
        <div className="flex flex-col min-h-0 flex-1">
          <ul className="flex-1 min-h-0 overflow-y-auto list-none p-0 m-0">
            {blocks.map((block) => (
              <li key={block.id}>
                <button
                  type="button"
                  onClick={() => updateState({ selectedIntakeBlockId: block.id })}
                  className={cn(
                    'w-full text-left border-b border-border px-3 py-2 transition',
                    block.id === state.selectedIntakeBlockId
                      ? 'bg-primary/10'
                      : 'hover:bg-secondary/70',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-foreground truncate">{block.label}</span>
                    {renderIntakeStatus(block.status)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Lines {block.startLine + 1}–{block.endLine + 1}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {state.mode === 'review' && (
        <>
          <ul className="flex flex-col overflow-y-auto overflow-x-hidden list-none p-0 m-0 flex-1 min-h-0">
            {state.reviewItems.map((item) => (
              <FileListEntry
                key={item.id}
                file={item.file}
                lineCount={item.lineCount}
                language={item.language}
                mode={item.mode}
                status={getReviewSidebarStatus(item, state.reviewPreflightByItem)}
                validationError={getReviewSidebarError(item, state.reviewPreflightByItem)}
                isSelected={state.selectedItemId === item.id}
                onClick={() => handleSelectItem(item.id)}
                onDoubleClick={(event) => handleOpenDirectiveEditor(item, event)}
              />
            ))}
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
