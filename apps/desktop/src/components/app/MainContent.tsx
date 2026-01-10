import React from 'react';
import { FileSidebar } from './FileSidebar';
import { IntakePanel } from './IntakePanel';
import { ReviewPanel } from './ReviewPanel';
import { useAppStateContext } from '@/hooks';
import { History, Settings, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function MainContent() {
  const { state, updateState } = useAppStateContext();

  return (
    <div className="flex-1 grid grid-cols-[280px_1fr_64px] min-h-0 xl:grid-cols-[280px_1fr_64px] lg:grid-cols-[240px_1fr] md:grid-cols-1">
      <FileSidebar />

      <main className="flex flex-col min-h-0 p-5 bg-transparent">
        {state.mode === 'intake' && <IntakePanel />}

        {state.mode === 'review' && <ReviewPanel />}
      </main>

      <aside className="hidden xl:flex flex-col items-center gap-2.5 p-3 bg-card border-l border-border">
        <Button
          variant="outline"
          size="icon"
          aria-label="View history"
          onClick={() => updateState({ statusMessage: 'History (placeholder)' })}
        >
          <History className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label="Open settings"
          onClick={() => updateState({ statusMessage: 'Settings (placeholder)' })}
        >
          <Settings className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label="Show information"
          onClick={() => updateState({ statusMessage: 'Info (placeholder)' })}
        >
          <Info className="h-4 w-4" />
        </Button>
      </aside>
    </div>
  );
}
