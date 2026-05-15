import { useCallback, useState } from 'react';
import type {ApplyPlan, IgnoreRules, IndexStatus, ParsedBlock, ValidationError} from '@inscribe/shared';
import type { AppMode, AppState, ReviewItem, PipelineStatus } from '@/types';
import { applyAppStateUpdates } from './appStateUtils';

export const initialState: AppState = {
  repoRoot: null,
  topLevelFolders: [],
  scope: [],
  ignore: { entries: [], source: 'none', path: '' },
  suggested: [],
  indexedFiles: [],
  indexedFileSet: new Set(),
  indexedCount: 0,
  indexStatus: { state: 'idle' },

  mode: 'intake',
  aiInput: '',
  parseErrors: [],
  parsedBlocks: [],
  validationErrors: [],
  reviewItems: [],
  selectedItemId: null,
  selectedIntakeBlockId: null,

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
  isLeftPanelCollapsed: false,
  isRightPanelCollapsed: false,
  hiddenRightPanelSections: [],
  openRightPanelSections: ['selection', 'directives', 'diagnostics'],
  collapsedHunkIdsByItem: {},
  collapsedDiffGroupIdsByItem: {},
  isTerminalOpen: false,
  terminalCommandSuggestions: [],
  terminalSuggestionSourceApplyId: null,

  lastAppliedPlan: null,
  canRedo: false,
  lastApplyId: null,
  canUndoApply: false,
  historyItems: [],
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
    setState((prev) => ({
      ...prev,
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
    }));
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
