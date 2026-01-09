import React from 'react';
import { EmptyState, FileListItem } from '../common';
import { useAppStateContext, useReviewActions } from '../../hooks';

export function FileSidebar() {
  const { state } = useAppStateContext();
  const { handleSelectItem } = useReviewActions();

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div>
          <p className="eyebrow">
            {state.mode === 'intake' ? 'Parsed Code Blocks' : 'Code Changes'}
          </p>
          <h3>{state.mode === 'intake' ? '0 files' : `${state.reviewItems.length} files`}</h3>
        </div>
      </div>

      {state.mode === 'intake' && <EmptyState message="Paste AI response to begin" />}

      {state.mode === 'review' && (
        <ul className="file-list">
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
