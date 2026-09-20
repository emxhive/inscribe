import { useCallback } from 'react';
import { resolvePrimaryAction, type PrimaryAction } from '@/utils/primaryAction';
import { useAppStateContext } from './useAppStateContext';
import { useApplyActions } from './useApplyActions';
import { useHistoryActions } from './useHistoryActions';
import { useParsingActions } from './useParsingActions';

export function usePrimaryAction(): {
  action: PrimaryAction;
  run: () => void;
} {
  const { state, updateState } = useAppStateContext();
  const { handleParseBlocks } = useParsingActions();
  const { handleApplyAll } = useApplyActions();
  const { restoreReviewedAction } = useHistoryActions();
  const action = resolvePrimaryAction(state);

  const run = useCallback(() => {
    if (!action.enabled) return;

    switch (action.id) {
      case 'parse':
        void handleParseBlocks();
        break;
      case 'review-partial':
        updateState({
          mode: 'review',
          rightPanelView: 'properties',
          statusMessage: `Reviewing ${state.reviewFiles.length} final file${state.reviewFiles.length === 1 ? '' : 's'}; excluded blocks remain unapplied.`,
        });
        break;
      case 'apply-all':
        void handleApplyAll();
        break;
      case 'history-restore':
        void restoreReviewedAction();
        break;
      case 'none':
        break;
    }
  }, [action, handleApplyAll, handleParseBlocks, restoreReviewedAction, state.reviewFiles.length, updateState]);

  return { action, run };
}
