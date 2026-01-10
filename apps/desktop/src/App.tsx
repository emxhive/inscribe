import React, { useState } from 'react';
import { AppStateProvider, useAppStateContext } from './hooks';
import { ScopeModal } from './components/ScopeModal';
import { IgnoreEditorModal } from './components/IgnoreEditorModal';
import { ListModal } from './components/ListModal';
import { AppHeader } from './components/app/AppHeader';
import { MainContent } from './components/app/MainContent';
import { StatusBar } from './components/StatusBar';

export default function App() {
  return (
    <AppStateProvider>
      <AppShell />
    </AppStateProvider>
  );
}

function AppShell() {
  const { state } = useAppStateContext();
  const [scopeModalOpen, setScopeModalOpen] = useState(false);
  const [ignoreModalOpen, setIgnoreModalOpen] = useState(false);
  const [ignoredListModalOpen, setIgnoredListModalOpen] = useState(false);
  const [suggestedListModalOpen, setSuggestedListModalOpen] = useState(false);

  const hasRepository = Boolean(state.repoRoot);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      <AppHeader
        onOpenScopeModal={() => hasRepository && setScopeModalOpen(true)}
        onOpenIgnoreEditor={() => hasRepository && setIgnoreModalOpen(true)}
        onOpenSuggestedList={() => setSuggestedListModalOpen(true)}
        onOpenIgnoredList={() => setIgnoredListModalOpen(true)}
      />

      <MainContent />

      <StatusBar />

      {/* Modals */}
      <ScopeModal
        isOpen={scopeModalOpen}
        onClose={() => setScopeModalOpen(false)}
      />

      <IgnoreEditorModal
        isOpen={ignoreModalOpen}
        onClose={() => setIgnoreModalOpen(false)}
      />

      <ListModal
        isOpen={ignoredListModalOpen}
        onClose={() => setIgnoredListModalOpen(false)}
        title="Ignored Paths"
        items={state.ignore.entries}
        emptyMessage="No paths are explicitly ignored"
      />

      <ListModal
        isOpen={suggestedListModalOpen}
        onClose={() => setSuggestedListModalOpen(false)}
        title="Suggested Excludes"
        items={state.suggested}
        emptyMessage="No suggested excludes"
      />
    </div>
  );
}
