import { useState, useCallback } from 'react';
import type {ApplyPlan, IgnoreRules, IndexStatus, ParsedBlock, ValidationError} from '@inscribe/shared';
import type { AppMode, AppState, ReviewItem, PipelineStatus } from '../types';

export const initialState: AppState = {
  repoRoot: null,
  topLevelFolders: [],
  scope: [],
  ignore: { entries: [], source: 'none', path: '' },
  suggested: [],
  indexedCount: 0,
  indexStatus: { state: 'idle' },

  mode: 'intake',
  aiInput: '',
  parseErrors: [],
  parsedBlocks: [],
  validationErrors: [],
  reviewItems: [],
  selectedItemId: null,

  isEditing: false,
  statusMessage: 'Ready',
  pipelineStatus: 'idle',
  isParsingInProgress: false,
  isApplyingInProgress: false,

  lastAppliedPlan: null,
  canRedo: false,
};

export function useAppState() {
  const [state, setState] = useState<AppState>(initialState);

  // Single updater function for all state updates
  const updateState = useCallback((updates: Partial<AppState> | ((prev: AppState) => Partial<AppState>)) => {
    setState((prev) => {
      const changes = typeof updates === 'function' ? updates(prev) : updates;
      return { ...prev, ...changes };
    });
  }, []);

  // Specialized updaters for complex operations
  const updateReviewItemContent = useCallback((id: string, editedContent: string) => {
    setState((prev) => ({
      ...prev,
      reviewItems: prev.reviewItems.map((item) =>
        item.id === id ? { ...item, editedContent } : item
      ),
    }));
  }, []);

  const setLastAppliedPlan = useCallback((plan: ApplyPlan | null) => {
    setState((prev) => ({ ...prev, lastAppliedPlan: plan, canRedo: plan !== null }));
  }, []);

  const clearRedo = useCallback(() => {
    setState((prev) => ({ ...prev, lastAppliedPlan: null, canRedo: false }));
  }, []);

  return {
    state,
    updateState,
    updateReviewItemContent,
    setLastAppliedPlan,
    clearRedo,
  };
}
