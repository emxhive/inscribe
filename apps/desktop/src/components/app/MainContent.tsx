import React from 'react';
import { FileSidebar } from './FileSidebar';
import { IntakePanel } from './IntakePanel';
import { ReviewPanel } from './ReviewPanel';
import { useAppStateContext } from '@/hooks';
import { History, Settings, Info } from 'lucide-react';

export function MainContent() {
  const { state, updateState } = useAppStateContext();
  const isIntakeMaximized = state.mode === 'intake' && state.isIntakeMaximized;
  const isReviewMaximized = state.mode === 'review' && state.isReviewMaximized;
  const isPanelMaximized = isIntakeMaximized || isReviewMaximized;
  const layoutClass = isPanelMaximized
    ? 'flex-1 flex min-h-0 overflow-hidden'
    : 'flex-1 grid grid-cols-[280px_1fr_64px] min-h-0 overflow-hidden';

  return (
    <div className={layoutClass}>
      {!isPanelMaximized && <FileSidebar />}

      <main className="flex flex-col min-h-0 overflow-y-auto p-5 bg-transparent">
        {state.isRestoringRepo && (
          <div className="flex flex-1 items-center justify-center text-muted-foreground">
            Restoring last repository...
          </div>
        )}

        {!state.isRestoringRepo && state.mode === 'intake' && <IntakePanel />}

        {!state.isRestoringRepo && state.mode === 'review' && <ReviewPanel />}
      </main>

      {!isPanelMaximized && (
        <aside className="flex flex-col items-center gap-2.5 p-3 bg-card border-l border-border">
          <button
            className="h-9 w-9 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
            aria-label="View history"
            onClick={() => updateState({ statusMessage: 'History (placeholder)' })}
          >
            <History className="h-4 w-4" />
          </button>
          <button
            className="h-9 w-9 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
            aria-label="Open settings"
            onClick={() => updateState({ statusMessage: 'Settings (placeholder)' })}
          >
            <Settings className="h-4 w-4" />
          </button>
          <button
            className="h-9 w-9 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
            aria-label="Show information"
            onClick={() => updateState({ statusMessage: 'Info (placeholder)' })}
          >
            <Info className="h-4 w-4" />
          </button>
        </aside>
      )}
    </div>
  );
}
