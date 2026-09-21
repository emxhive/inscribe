import { normalizeRelativePath } from '@inscribe/shared';
import type { HistoryEntry } from '@inscribe/shared';
import { useRef } from 'react';
import { decorateHistoryEntries } from '@/utils';
import { useAppStateContext } from './useAppStateContext';
import { initialState } from './useAppState';
import type { AppState } from '@/types';
import type { RepoInitResult } from '@/types/ipc';

const buildIndexedFileState = (indexedFiles: string[] | undefined) => {
  const normalized = (indexedFiles || []).map((file) => normalizeRelativePath(file));
  return {
    indexedFiles: normalized,
    indexedFileSet: new Set(normalized),
  };
};

export async function initRepositoryState(
  repoRoot: string,
  updateState: (updates: Partial<AppState>) => void
): Promise<RepoInitResult> {
  updateState({ statusMessage: 'Initializing repository...' });
  const result = await window.inscribeAPI.repoInit(repoRoot);
  let historyEntries: HistoryEntry[] = [];
  try {
    historyEntries = await window.inscribeAPI.getHistoryEntries(repoRoot);
  } catch (error) {
    console.error('Failed to load history entries:', error);
  }
  const indexedFileState = buildIndexedFileState(result.indexedFiles);

  updateState({
    topLevelFolders: result.topLevelFolders || [],
    ignore: result.ignore || { entries: [], source: 'none', path: '' },
    suggested: result.suggested || [],
    indexedFiles: indexedFileState.indexedFiles,
    indexedFileSet: indexedFileState.indexedFileSet,
    indexedCount: indexedFileState.indexedFiles.length,
    indexStatus: result.indexStatus || { state: 'complete' },
    historyItems: decorateHistoryEntries(historyEntries),
    statusMessage: `Repository initialized: ${indexedFileState.indexedFiles.length} files indexed`
  });

  return result;
}

/**
 * Hook for repository-related operations
 */
export function useRepositoryActions() {
  const { state, updateState } = useAppStateContext();
  const stateRef = useRef(state);
  stateRef.current = state;
  const resetRepositoryState = (repoRoot: string | null, statusMessage: string) => {
    updateState({
      repoRoot,
      topLevelFolders: [],
      ignore: initialState.ignore,
      suggested: [],
      indexedFiles: [],
      indexedFileSet: new Set(),
      indexedCount: 0,
      indexStatus: { state: 'idle' },
      mode: 'intake',
      aiInput: '',
      parseErrors: [],
      parseWarnings: [],
      previewDiagnostics: [],
      reviewItems: [],
      reviewFiles: [],
      selectedReviewFileId: null,
      selectedIntakeBlockId: null,
      selectedIntakeLineIndex: null,
      rightPanelOwner: 'inspector',
      rightPanelView: 'properties',
      pipelineStatus: 'idle',
      isParsingInProgress: false,
      isApplyingInProgress: false,
      isRestoringInProgress: false,
            historyItems: [],
      historyReview: initialState.historyReview,
      lastAppliedActionId: null,
      collapsedHunkIdsByFile: {},
      collapsedDiffGroupIdsByFile: {},
      statusMessage,
    });
  };
  const handleBrowseRepo = async () => {
    if (stateRef.current.isRestoringInProgress) return;

    try {
      const selectedPath = await window.inscribeAPI.selectRepository(stateRef.current.repoRoot || undefined);
      if (!selectedPath) return;
      if (stateRef.current.isRestoringInProgress) return;

      await window.inscribeAPI.openRepository(selectedPath);
    } catch (error) {
      console.error('Failed to select repository:', error);
      updateState({ 
        statusMessage: 'Failed to select repository',
        indexStatus: { state: 'error', message: String(error) }
      });
    }
  };

  const initRepo = async (repoRoot: string): Promise<RepoInitResult | null> => {
    try {
      resetRepositoryState(repoRoot, 'Initializing repository...');
      return await initRepositoryState(repoRoot, updateState);
    } catch (error) {
      console.error('Failed to initialize repository:', error);
      updateState({ 
        statusMessage: 'Failed to initialize repository',
        indexStatus: { state: 'error', message: String(error) }
      });
    }
    return null;
  };

  const restoreLastRepo = async () => {
    updateState({ isRestoringRepo: true, statusMessage: 'Restoring repository...' });
    try {
      // First check if this window is already bound to a repo
      const boundRepo = await window.inscribeAPI.getWindowRepo();
      if (boundRepo) {
        await initRepo(boundRepo);
        return;
      }

      const lastRepo = await window.inscribeAPI.getLastVisitedRepo();
      if (!lastRepo) {
        resetRepositoryState(null, 'Select a repository to start.');
        return;
      }

      // Restore the last repo into this window even if another window already
      // has it open. Auto-routing would focus that window and leave this one
      // unbound.
      await window.inscribeAPI.openRepository(lastRepo, 'same-window');
    } catch (error) {
      console.error('Failed to restore repository:', error);
      resetRepositoryState(null, 'Unable to restore repository. Select a repository to start.');
      updateState({ indexStatus: { state: 'error', message: String(error) } });
    } finally {
      updateState({ isRestoringRepo: false });
    }
  };

  const handleSaveIgnore = async (content: string) => {
    if (!state.repoRoot) return;
    
    try {
      updateState({ statusMessage: 'Saving ignore file...' });
      const result = await window.inscribeAPI.writeIgnore(state.repoRoot, content);
      
      if (result.success) {
        const indexedFileState = buildIndexedFileState(result.indexedFiles);
        updateState({
          suggested: result.suggested || [],
          indexedFiles: indexedFileState.indexedFiles,
          indexedFileSet: indexedFileState.indexedFileSet,
          indexedCount: indexedFileState.indexedFiles.length,
          indexStatus: result.indexStatus || { state: 'complete' },
          statusMessage: `Ignore rules updated: ${indexedFileState.indexedFiles.length} files indexed`
        });
      } else {
        updateState({ statusMessage: `Failed to update ignore rules: ${result.error || 'Unknown error'}` });
      }
    } catch (error) {
      console.error('Failed to save ignore file:', error);
      updateState({ statusMessage: 'Failed to save ignore file' });
    }
  };

  return {
    handleBrowseRepo,
    handleSaveIgnore,
    initRepo,
    restoreLastRepo,
  };
}
