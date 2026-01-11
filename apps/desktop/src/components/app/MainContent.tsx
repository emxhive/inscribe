import React, { useCallback, useState } from 'react';
import { FileSidebar, MAX_SIDEBAR_WIDTH, MIN_SIDEBAR_WIDTH } from './FileSidebar';
import { IntakePanel } from './IntakePanel';
import { ReviewPanel } from './ReviewPanel';
import { useAppStateContext } from '@/hooks';
import { History, Settings, Info } from 'lucide-react';

export function MainContent() {
  const { state, updateState } = useAppStateContext();
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    if (typeof window === 'undefined') {
      return 280;
    }
    const stored = window.localStorage.getItem('inscribe:intake:sidebarWidth');
    const parsed = stored ? Number(stored) : 280;
    if (!Number.isFinite(parsed)) {
      return 280;
    }
    return Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, parsed));
  });

  const handleSidebarResize = useCallback(
    (width: number, options?: { persist?: boolean }) => {
      const clamped = Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, width));
      setSidebarWidth(clamped);
      if (options?.persist && typeof window !== 'undefined') {
        window.localStorage.setItem('inscribe:intake:sidebarWidth', String(clamped));
      }
    },
    [],
  );

  return (
    <div
      className="flex-1 grid min-h-0 overflow-hidden"
      style={{ gridTemplateColumns: `${sidebarWidth}px 1fr 64px` }}
    >
      <FileSidebar sidebarWidth={sidebarWidth} onResize={handleSidebarResize} />

      <main className="flex flex-col min-h-0 overflow-y-auto p-5 bg-transparent">
        {state.isRestoringRepo && (
          <div className="flex flex-1 items-center justify-center text-muted-foreground">
            Restoring last repository...
          </div>
        )}

        {!state.isRestoringRepo && state.mode === 'intake' && <IntakePanel />}

        {!state.isRestoringRepo && state.mode === 'review' && <ReviewPanel />}
      </main>

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
    </div>
  );
}
