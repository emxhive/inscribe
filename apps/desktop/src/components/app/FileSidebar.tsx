import React from 'react';
import { EmptyState, FileListItem } from '../common';
import type { AppMode, ReviewItem } from '../../types';

interface FileSidebarProps {
  mode: AppMode;
  reviewItems: ReviewItem[];
  selectedItemId: string | null;
  onSelectItem: (id: string) => void;
}

export function FileSidebar({
  mode,
  reviewItems,
  selectedItemId,
  onSelectItem,
}: FileSidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div>
          <p className="eyebrow">
            {mode === 'intake' ? 'Parsed Code Blocks' : 'Code Changes'}
          </p>
          <h3>{mode === 'intake' ? '0 files' : `${reviewItems.length} files`}</h3>
        </div>
      </div>

      {mode === 'intake' && <EmptyState message="Paste AI response to begin" />}

      {mode === 'review' && (
        <ul className="file-list">
          {reviewItems.map((item) => (
            <FileListItem
              key={item.id}
              file={item.file}
              lineCount={item.lineCount}
              language={item.language}
              mode={item.mode}
              status={item.status}
              validationError={item.validationError}
              isSelected={selectedItemId === item.id}
              onClick={() => onSelectItem(item.id)}
            />
          ))}
        </ul>
      )}
    </aside>
  );
}
