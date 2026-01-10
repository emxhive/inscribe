import React, { useEffect, useRef, useState } from 'react';
import { EmptyState, FileListItem } from '../common';
import { Badge } from '@/components/ui/badge';
import { useAppStateContext, useReviewActions, useIntakeBlocks } from '@/hooks';
import { updateDirectiveInText } from '@/utils/intake';
import { cn } from '@/lib/utils';
import { DIRECTIVE_KEYS } from '@inscribe/shared';

const MIN_SIDEBAR_WIDTH = 240;
const MAX_SIDEBAR_WIDTH = 420;
const SIDEBAR_WIDTH_STORAGE_KEY = 'inscribe:intake:sidebarWidth';

export function FileSidebar() {
  const { state, updateState } = useAppStateContext();
  const { handleSelectItem } = useReviewActions();
  const { blocks } = useIntakeBlocks();
  const selectedBlock = blocks.find((block) => block.id === state.selectedIntakeBlockId) ?? null;
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    if (typeof window === 'undefined') {
      return 280;
    }
    const stored = window.localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY);
    const parsed = stored ? Number(stored) : 280;
    if (!Number.isFinite(parsed)) {
      return 280;
    }
    return Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, parsed));
  });
  const [dragging, setDragging] = useState(false);
  const sidebarRef = useRef<HTMLElement | null>(null);
  const directiveRefs = useRef(new Map<string, HTMLInputElement | null>());

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
      setSidebarWidth(nextWidth);
    };

    const handleMouseUp = () => {
      setDragging(false);
      window.localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(sidebarWidth));
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, sidebarWidth]);

  const handleDirectiveChange = (key: typeof DIRECTIVE_KEYS[number], value: string) => {
    if (!selectedBlock) {
      return;
    }
    updateState((prev) => ({
      aiInput: updateDirectiveInText(prev.aiInput, selectedBlock, key, value),
    }));
  };

  const presentDirectives = selectedBlock
    ? DIRECTIVE_KEYS.filter((key) => selectedBlock.directives[key])
    : [];

  const handleAddDirective = (key: typeof DIRECTIVE_KEYS[number]) => {
    if (!selectedBlock) {
      return;
    }
    if (selectedBlock.directives[key]) {
      directiveRefs.current.get(key)?.focus();
      return;
    }
    updateState((prev) => ({
      aiInput: updateDirectiveInText(prev.aiInput, selectedBlock, key, '', { allowEmptyInsert: true }),
    }));
    requestAnimationFrame(() => {
      directiveRefs.current.get(key)?.focus();
    });
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

          <div className="border-t border-border pt-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
              Directives
            </p>
            {selectedBlock ? (
              <div className="mt-3 space-y-3">
                {presentDirectives.length > 0 ? (
                  presentDirectives.map((key) => (
                    <label key={key} className="block text-xs text-muted-foreground">
                      <span className="text-[11px] font-semibold text-foreground">{key}</span>
                      <input
                        ref={(element) => directiveRefs.current.set(key, element)}
                        value={selectedBlock.directives[key]?.value ?? ''}
                        onChange={(event) => handleDirectiveChange(key, event.target.value)}
                        className="mt-1 w-full rounded-md border border-border bg-secondary/60 px-2.5 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                        placeholder={`@inscribe ${key.toLowerCase()}:`}
                      />
                    </label>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">No directives found.</p>
                )}
                <div className="flex items-center gap-2">
                  <label className="text-[11px] font-semibold text-foreground">Add directive</label>
                  <select
                    className="flex-1 rounded-md border border-border bg-secondary/60 px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                    value=""
                    onChange={(event) => {
                      if (event.target.value) {
                        handleAddDirective(event.target.value as typeof DIRECTIVE_KEYS[number]);
                      }
                    }}
                  >
                    <option value="" disabled>Select</option>
                    {DIRECTIVE_KEYS.map((key) => (
                      <option key={key} value={key}>
                        {key}
                      </option>
                    ))}
                  </select>
                </div>
                {(selectedBlock.warnings.length > 0 || selectedBlock.errors.length > 0) && (
                  <div className="rounded-md border border-border bg-muted/50 p-2 text-[11px] text-muted-foreground">
                    {selectedBlock.errors.length > 0 && (
                      <p className="text-red-700">Error: {selectedBlock.errors[0]}</p>
                    )}
                    {selectedBlock.warnings.length > 0 && (
                      <p className="text-amber-700">Warning: {selectedBlock.warnings[0]}</p>
                    )}
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground">
                  Changes update the raw text inline.
                </p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground mt-2">
                Select a block to edit directives.
              </p>
            )}
          </div>
        </div>
      )}

      {state.mode === 'review' && (
        <ul className="flex flex-col gap-2.5 overflow-y-auto list-none p-0 m-0">
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
            />
          ))}
        </ul>
      )}
      {state.mode === 'intake' && (
        <button
          type="button"
          aria-label="Resize sidebar"
          onMouseDown={() => setDragging(true)}
          className={cn(
            'absolute top-0 right-0 h-full w-1.5 cursor-col-resize',
            dragging ? 'bg-primary/20' : 'hover:bg-border',
          )}
        />
      )}
    </aside>
  );
}
