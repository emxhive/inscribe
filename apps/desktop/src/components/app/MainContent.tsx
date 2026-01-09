import React from 'react';
import { FileSidebar } from './FileSidebar';
import { IntakePanel } from './IntakePanel';
import { ReviewPanel } from './ReviewPanel';
import { useAppStateContext } from '../../hooks';

export function MainContent() {
  const { state, updateState } = useAppStateContext();

  return (
    <div className="layout">
      <FileSidebar />

      <main className="main-panel">
        {state.mode === 'intake' && <IntakePanel />}

        {state.mode === 'review' && <ReviewPanel />}
      </main>

      <aside className="right-rail">
        <button
          type="button"
          className="rail-btn"
          aria-label="View history"
          onClick={() => updateState({ statusMessage: 'History (placeholder)' })}
        >
          🕑
        </button>
        <button
          type="button"
          className="rail-btn"
          aria-label="Open settings"
          onClick={() => updateState({ statusMessage: 'Settings (placeholder)' })}
        >
          ⚙️
        </button>
        <button
          type="button"
          className="rail-btn"
          aria-label="Show information"
          onClick={() => updateState({ statusMessage: 'Info (placeholder)' })}
        >
          ℹ️
        </button>
      </aside>
    </div>
  );
}
