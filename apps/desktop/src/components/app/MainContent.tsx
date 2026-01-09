import React from 'react';
import { FileSidebar } from './FileSidebar';
import { IntakePanel } from './IntakePanel';
import { ReviewPanel } from './ReviewPanel';
import type { AppMode, ReviewItem } from '../../types';

interface MainContentProps {
  mode: AppMode;
  reviewItems: ReviewItem[];
  selectedItemId: string | null;
  selectedItem?: ReviewItem;
  parseErrors: string[];
  aiInput: string;
  isEditing: boolean;
  isParsingInProgress: boolean;
  isApplyingInProgress: boolean;
  canRedo: boolean;
  statusMessage: string;
  validItemsCount: number;
  editorValue: string;
  onSelectItem: (id: string) => void;
  onAiInputChange: (value: string) => void;
  onParseBlocks: () => void;
  onToggleEditing: () => void;
  onEditorChange: (value: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onResetAll: () => void;
  onApplySelected: () => void;
  onApplyValidBlocks: () => void;
  onApplyAll: () => void;
  onStatusMessage: (value: string) => void;
  canParse: boolean;
}

export function MainContent({
  mode,
  reviewItems,
  selectedItemId,
  selectedItem,
  parseErrors,
  aiInput,
  isEditing,
  isParsingInProgress,
  isApplyingInProgress,
  canRedo,
  statusMessage,
  validItemsCount,
  editorValue,
  onSelectItem,
  onAiInputChange,
  onParseBlocks,
  onToggleEditing,
  onEditorChange,
  onUndo,
  onRedo,
  onResetAll,
  onApplySelected,
  onApplyValidBlocks,
  onApplyAll,
  onStatusMessage,
  canParse,
}: MainContentProps) {
  const hasInvalidItems = reviewItems.some(item => item.status === 'invalid');

  return (
    <div className="layout">
      <FileSidebar
        mode={mode}
        reviewItems={reviewItems}
        selectedItemId={selectedItemId}
        onSelectItem={onSelectItem}
      />

      <main className="main-panel">
        {mode === 'intake' && (
          <IntakePanel
            aiInput={aiInput}
            parseErrors={parseErrors}
            isParsingInProgress={isParsingInProgress}
            canParse={canParse}
            onAiInputChange={onAiInputChange}
            onParseBlocks={onParseBlocks}
          />
        )}

        {mode === 'review' && (
          <ReviewPanel
            selectedItem={selectedItem}
            isEditing={isEditing}
            editorValue={editorValue}
            isApplyingInProgress={isApplyingInProgress}
            canRedo={canRedo}
            statusMessage={statusMessage}
            validItemsCount={validItemsCount}
            hasInvalidItems={hasInvalidItems}
            onToggleEditing={onToggleEditing}
            onEditorChange={onEditorChange}
            onUndo={onUndo}
            onRedo={onRedo}
            onResetAll={onResetAll}
            onApplySelected={onApplySelected}
            onApplyValidBlocks={onApplyValidBlocks}
            onApplyAll={onApplyAll}
            onStatusMessage={onStatusMessage}
          />
        )}
      </main>

      <aside className="right-rail">
        <button
          type="button"
          className="rail-btn"
          aria-label="View history"
          onClick={() => onStatusMessage('History (placeholder)')}
        >
          🕑
        </button>
        <button
          type="button"
          className="rail-btn"
          aria-label="Open settings"
          onClick={() => onStatusMessage('Settings (placeholder)')}
        >
          ⚙️
        </button>
        <button
          type="button"
          className="rail-btn"
          aria-label="Show information"
          onClick={() => onStatusMessage('Info (placeholder)')}
        >
          ℹ️
        </button>
      </aside>
    </div>
  );
}
