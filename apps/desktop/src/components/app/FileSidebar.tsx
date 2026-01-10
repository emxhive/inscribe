import React from 'react';
import { EmptyState, FileListItem } from '../common';
import { useAppStateContext, useReviewActions } from '@/hooks';

export function FileSidebar() {
  const { state } = useAppStateContext();
  const { handleSelectItem } = useReviewActions();

  return (
    <aside className="flex flex-col gap-3 p-4 bg-card border-r border-border">
      <div className="flex flex-col gap-1">
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
          {state.mode === 'intake' ? 'Parsed Code Blocks' : 'Code Changes'}
        </p>
        <h3 className="text-lg font-semibold">
          {state.mode === 'intake' ? '0 files' : `${state.reviewItems.length} files`}
        </h3>
      </div>

      {state.mode === 'intake' && <EmptyState message="Paste AI response to begin" />}

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
