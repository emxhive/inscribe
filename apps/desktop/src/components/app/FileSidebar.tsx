import React, { useEffect, useRef, useState } from 'react';
import { EmptyState, FileListItem } from '../common';
import { Badge } from '@/components/ui/badge';
import { useAppStateContext, useReviewActions, useIntakeBlocks } from '@/hooks';
import { updateDirectiveInText } from '@/utils/intake';
import { cn } from '@/lib/utils';
import { type DirectiveKey, type HeaderKey } from '@inscribe/shared';
import type { ReviewItem } from '@/types';
import { ReviewDirectivePopover } from './ReviewDirectivePopover';
import { HeaderDirectiveEditor } from './HeaderDirectiveEditor';

export const MIN_SIDEBAR_WIDTH = 240;
export const MAX_SIDEBAR_WIDTH = 420;

type FileSidebarProps = {
  sidebarWidth: number;
  onResize: (width: number, options?: { persist?: boolean }) => void;
};

export function FileSidebar({ sidebarWidth, onResize }: FileSidebarProps) {
  const { state, updateState } = useAppStateContext();
  const { handleSelectItem, handleUpdateDirectives } = useReviewActions();
  const { blocks } = useIntakeBlocks();
  const selectedBlock = blocks.find((block) => block.id === state.selectedIntakeBlockId) ?? null;
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
    if (blocks.length > 0 && !selectedBlock) {
      updateState({ selectedIntakeBlockId: blocks[0].id });
    }
  }, [blocks, selectedBlock, state.mode, state.selectedIntakeBlockId, updateState]);

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

  const handleHeaderChange = (key: HeaderKey, value: string) => {
    if (!selectedBlock) {
      return;
    }
    updateState((prev) => ({
      aiInput: updateDirectiveInText(prev.aiInput, selectedBlock, key, value, { keepEmpty: true }),
    }));
  };

  const handleDirectiveChange = (key: DirectiveKey, value: string) => {
    if (!selectedBlock) {
      return;
    }
    updateState((prev) => ({
      aiInput: updateDirectiveInText(prev.aiInput, selectedBlock, key, value),
    }));
  };

  const handleAddDirective = (key: DirectiveKey) => {
    if (!selectedBlock) {
      return;
    }
    if (selectedBlock.directives[key]) {
      return;
    }
    updateState((prev) => ({
      aiInput: updateDirectiveInText(prev.aiInput, selectedBlock, key, '', { allowEmptyInsert: true }),
    }));
  };

  const handleOpenDirectiveEditor = (
    item: ReviewItem,
    event: React.MouseEvent<HTMLLIElement>,
  ) => {
    event.stopPropagation();
    directiveAnchorRef.current = event.currentTarget;
    setDirectiveEditorItemId(item.id);
  };

  return (
    <aside
      ref={sidebarRef}
      className="relative flex flex-col gap-3 p-4 bg-card border-r border-border min-h-0"
      style={{ width: sidebarWidth }}
    >
      <div className="flex flex-col gap-1">
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
          {state.mode === 'intake' ? 'Parsed Code Blocks' : 'Code Changes'}
        </p>
        <h3 className="text-lg font-semibold">
          {state.mode === 'intake' ? `${blocks.length} blocks` : `${state.reviewItems.length} files`}
        </h3>
      </div>

      {state.mode === 'intake' && blocks.length === 0 && (
        <EmptyState message="Paste AI response to begin" />
      )}

      {state.mode === 'intake' && blocks.length > 0 && (
        <div className="flex flex-col gap-3 min-h-0 flex-1">
          <ul className="flex-1 min-h-0 overflow-y-auto list-none p-0 m-0 space-y-2.5">
            {blocks.map((block) => (
              <li key={block.id}>
                <button
                  type="button"
                  onClick={() => updateState({ selectedIntakeBlockId: block.id })}
                  className={cn(
                    'w-full text-left rounded-lg border px-3 py-2.5 transition',
                    block.id === state.selectedIntakeBlockId
                      ? 'border-primary/60 bg-primary/10 shadow-sm'
                      : 'border-border bg-secondary/50 hover:bg-secondary/70',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-foreground truncate">{block.label}</span>
                    <Badge
                      variant={block.status === 'error' ? 'destructive' : 'secondary'}
                      className={cn(
                        block.status === 'warning' && 'bg-amber-100 text-amber-900 border border-amber-200',
                        block.status === 'valid' && 'bg-emerald-100 text-emerald-900 border border-emerald-200',
                      )}
                    >
                      {block.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Lines {block.startLine + 1}–{block.endLine + 1}
                  </p>
                  {block.warnings.length > 0 && (
                    <p className="text-xs text-amber-700 mt-1">{block.warnings[0]}</p>
                  )}
                  {block.errors.length > 0 && (
                    <p className="text-xs text-red-700 mt-1">{block.errors[0]}</p>
                  )}
                </button>
              </li>
            ))}
          </ul>

          <HeaderDirectiveEditor
            block={selectedBlock}
            onHeaderChange={handleHeaderChange}
            onDirectiveChange={handleDirectiveChange}
            onAddDirective={handleAddDirective}
          />
        </div>
      )}

      {state.mode === 'review' && (
        <>
          <ul className="flex flex-col gap-2.5 overflow-y-auto overflow-x-hidden list-none p-0 m-0 flex-1 min-h-0">
            {state.reviewItems.map((item) => (
              <FileListItem
                key={item.id}
                file={item.file}
                lineCount={item.lineCount}
                language={item.language}
                mode={item.mode}
                status={item.status}
                validationError={item.validationError}
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
