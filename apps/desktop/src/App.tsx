import React, { useEffect, useState } from 'react';
import { AppStateProvider, useAppStateContext, useRepositoryActions } from './hooks';
import { ScopeModal } from './components/ScopeModal';
import { IgnoreEditorModal } from './components/IgnoreEditorModal';
import { ListModal } from './components/ListModal';
import { WorkspaceShell } from './components/app/WorkspaceShell';

export default function App() {
  return (
    <AppStateProvider>
      <AppShell />
    </AppStateProvider>
  );
}

function AppShell() {
  const { state } = useAppStateContext();
  const repositoryActions = useRepositoryActions();
  const [scopeModalOpen, setScopeModalOpen] = useState(false);
  const [ignoreModalOpen, setIgnoreModalOpen] = useState(false);
  const [indexedListModalOpen, setIndexedListModalOpen] = useState(false);

  const hasRepository = Boolean(state.repoRoot);

  useEffect(() => {
    void repositoryActions.restoreLastRepo();
  }, []);

  useEffect(() => {
    return window.inscribeAPI.onOpenRepo((repoRoot) => {
      void repositoryActions.initRepo(repoRoot);
    });
  }, [repositoryActions]);

  return (
    <>
      <WorkspaceShell
        onOpenScopeModal={() => hasRepository && setScopeModalOpen(true)}
        onOpenIgnore={() => hasRepository && setIgnoreModalOpen(true)}
        onOpenIndexedList={() => setIndexedListModalOpen(true)}
      />

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
        isOpen={indexedListModalOpen}
        onClose={() => setIndexedListModalOpen(false)}
        title="Indexed Files"
        items={state.indexedFiles}
        emptyMessage="No indexed files"
      />
    </>
  );
}
