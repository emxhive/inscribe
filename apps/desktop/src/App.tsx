import React, { useEffect, useState } from 'react';
import { AppStateProvider, useAppStateContext, useRepositoryActions } from './hooks';
import { IgnoreEditorModal } from './components/IgnoreEditorModal';
import { ListModal } from './components/ListModal';
import { WorkspaceShell } from './components/app/WorkspaceShell';
import { getWindowTitle } from './utils';

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
  const [ignoreModalOpen, setIgnoreModalOpen] = useState(false);
  const [indexedListModalOpen, setIndexedListModalOpen] = useState(false);

  const hasRepository = Boolean(state.repoRoot);

  useEffect(() => {
    document.title = getWindowTitle(state.repoRoot);
  }, [state.repoRoot]);

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
        onOpenIgnore={() => hasRepository && setIgnoreModalOpen(true)}
        onOpenIndexedList={() => setIndexedListModalOpen(true)}
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
