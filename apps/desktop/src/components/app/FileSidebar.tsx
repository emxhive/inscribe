import React, { useEffect } from 'react';
import { EmptyState, FileListItem } from '../common';
import { Badge } from '@/components/ui/badge';
import { useAppStateContext, useReviewActions, useIntakeBlocks } from '@/hooks';
import { updateDirectiveInText } from '@/utils/intake';
import { cn } from '@/lib/utils';

export function FileSidebar() {
  const { state, updateState } = useAppStateContext();
  const { handleSelectItem } = useReviewActions();
  const { blocks } = useIntakeBlocks();
  const selectedBlock = blocks.find((block) => block.id === state.selectedIntakeBlockId) ?? null;

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

  const handleDirectiveChange = (key: 'FILE' | 'MODE' | 'START' | 'END', value: string) => {
    if (!selectedBlock) {
      return;
    }
    updateState((prev) => ({
      aiInput: updateDirectiveInText(prev.aiInput, selectedBlock, key, value),
    }));
  };

  return (
    <aside className="flex flex-col gap-3 p-4 bg-card border-r border-border min-h-0">
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
        <div className="flex flex-col gap-3 min-h-0">
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

          <div className="border-t border-border pt-3 mt-auto">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
              Directives
            </p>
            {selectedBlock ? (
              <div className="mt-3 space-y-3">
                {(['FILE', 'MODE', 'START', 'END'] as const).map((key) => (
                  <label key={key} className="block text-xs text-muted-foreground">
                    <span className="text-[11px] font-semibold text-foreground">{key}</span>
                    <input
                      value={selectedBlock.directives[key]?.value ?? ''}
                      onChange={(event) => handleDirectiveChange(key, event.target.value)}
                      className="mt-1 w-full rounded-md border border-border bg-secondary/60 px-2.5 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                      placeholder={`@inscribe ${key.toLowerCase()}:`}
                    />
                  </label>
                ))}
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
    </aside>
  );
}
