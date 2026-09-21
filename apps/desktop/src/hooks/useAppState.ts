import { useCallback, useState } from 'react';
import type { AppState } from '@/types';
import { applyAppStateUpdates } from './appStateUtils';

export const initialState: AppState = {
  repoRoot: null,
  topLevelFolders: [],
  ignore: { entries: [], source: 'none', path: '' },
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

  statusMessage: 'Restoring last repository...',
  pipelineStatus: 'idle',
  isParsingInProgress: false,
  isApplyingInProgress: false,
  isRestoringInProgress: false,
  isRestoringRepo: true,
  reviewView: 'unified',
  selectedHunkId: null,
  isLeftPanelCollapsed: false,
  isRightPanelCollapsed: false,
  rightPanelOwner: 'inspector',
  rightPanelView: 'properties',
  collapsedHunkIdsByFile: {},
  collapsedDiffGroupIdsByFile: {},
  isTerminalOpen: false,
  terminalCommandSuggestions: [],
  previewSession: null,
  lastAppliedActionId: null,
  historyItems: [],
  historyReview: {
    actionId: null,
    origin: null,
    requestId: null,
    selectedEntryId: null,
    preview: null,
    isLoading: false,
    isRestoring: false,
    error: null,
  },
};

export function useAppState() {
  const [state, setState] = useState<AppState>(initialState);

  // Single updater function for all state updates
  const updateState = useCallback((updates: Partial<AppState> | ((prev: AppState) => Partial<AppState>)) => {
    setState((prev) => {
      const changes = typeof updates === 'function' ? updates(prev) : updates;
      return applyAppStateUpdates(prev, changes);
    });
  }, []);

  return {
    state,
    updateState,
  };
}
