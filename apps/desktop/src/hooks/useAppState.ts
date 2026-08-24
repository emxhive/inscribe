import { useCallback, useState } from 'react';
import type { ApplyPlan } from '@inscribe/shared';
import type { AppState, ReviewItem } from '@/types';
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
  v2PreviewDiagnostics: [],
  parsedBlocks: [],
  validationErrors: [],
  reviewItems: [],
  selectedItemId: null,
  v2ReviewFiles: [],
  selectedV2FileId: null,
  selectedIntakeBlockId: null,
  selectedIntakeLineIndex: null,

  isEditing: false,
  statusMessage: 'Restoring last repository...',
  pipelineStatus: 'idle',
  isParsingInProgress: false,
  isApplyingInProgress: false,
  isRestoringInProgress: false,
  isRestoringRepo: true,
  reviewView: 'unified',
  selectedHunkId: null,
  reviewComparisonError: null,
  reviewPreflightByItem: {},
  reviewComparisonByItem: {},
  isLeftPanelCollapsed: false,
  isRightPanelCollapsed: false,
  rightPanelOwner: 'inspector',
  rightPanelView: 'properties',
  collapsedHunkIdsByItem: {},
  collapsedHunkIdsByFile: {},
  collapsedDiffGroupIdsByItem: {},
  collapsedDiffGroupIdsByFile: {},
  isTerminalOpen: false,
  terminalCommandSuggestions: [],
  terminalSuggestionSourceApplyId: null,

  lastAppliedPlan: null,
  canRedo: false,
  lastApplyId: null,
  canUndoApply: false,
  v2PreviewSession: null,
  historyItems: [],
  v2HistoryReview: {
    actionId: null,
    requestId: null,
    selectedEntryId: null,
    preview: null,
    isLoading: false,
    isRestoring: false,
    error: null,
  },
  legacyHistoryReview: {
    applyId: null,
    selectedEntryId: null,
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

  // Specialized updaters for complex operations
  const updateReviewItemContent = useCallback((id: string, editedContent: string) => {
    setState((prev) => {
      const { [id]: _cleared, ...reviewPreflightByItem } = prev.reviewPreflightByItem;
      const { [id]: _clearedComparison, ...reviewComparisonByItem } = prev.reviewComparisonByItem;
      return {
        ...prev,
        reviewComparisonError: prev.selectedItemId === id ? null : prev.reviewComparisonError,
        reviewPreflightByItem,
        reviewComparisonByItem,
        reviewItems: prev.reviewItems.map((item) => {
          if (item.id !== id) {
            return item;
          }
          const status: ReviewItem['status'] =
            item.status === 'invalid' ? 'invalid' : 'pending';
          return {
            ...item,
            editedContent,
            status,
          };
        }),
      };
    });
  }, []);

  const setLastAppliedPlan = useCallback((plan: ApplyPlan | null) => {
    setState((prev) => ({ ...prev, lastAppliedPlan: plan, canRedo: plan !== null }));
  }, []);

  const clearRedo = useCallback(() => {
    setState((prev) => ({ ...prev, canRedo: false }));
  }, []);

  return {
    state,
    updateState,
    updateReviewItemContent,
    setLastAppliedPlan,
    clearRedo,
  };
}
