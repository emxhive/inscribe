import { useState } from 'react';
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
  const updateState = (updates: Partial<AppState> | ((prev: AppState) => Partial<AppState>)) => {
    setState((prev) => {
      const changes = typeof updates === 'function' ? updates(prev) : updates;
      return { ...prev, ...changes };
    });
  };

  // Specialized updaters for complex operations
  const updateReviewItemContent = (id: string, editedContent: string) => {
    setState((prev) => ({
      ...prev,
      reviewItems: prev.reviewItems.map((item) =>
        item.id === id
          ? {
              ...item,
              editedContent,
              status: item.status === 'invalid' ? 'invalid' : 'pending',
            }
          : item
      ),
    }));
  };

  const setLastAppliedPlan = (plan: ApplyPlan | null) => {
    setState((prev) => ({ ...prev, lastAppliedPlan: plan, canRedo: plan !== null }));
  };

  const clearRedo = () => {
    setState((prev) => ({ ...prev, lastAppliedPlan: null, canRedo: false }));
  };

  return {
    state,
    updateState,
    updateReviewItemContent,
    setLastAppliedPlan,
    clearRedo,
  };
}
