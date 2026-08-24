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
  const { restoreV2ReviewedAction } = useHistoryActions();
  const action = resolvePrimaryAction(state);

  const run = useCallback(() => {
    if (!action.enabled) return;

    switch (action.id) {
      case 'parse':
        void handleParseBlocks();
        break;
      case 'review-v2-partial':
        updateState({
          mode: 'review',
          rightPanelView: 'properties',
          statusMessage: `Reviewing ${state.v2ReviewFiles.length} final file${state.v2ReviewFiles.length === 1 ? '' : 's'}; excluded blocks remain unapplied.`,
        });
        break;
      case 'apply-all':
        void handleApplyAll();
        break;
      case 'history-restore':
        void restoreV2ReviewedAction();
        break;
      case 'none':
        break;
    }
  }, [action, handleApplyAll, handleParseBlocks, restoreV2ReviewedAction, state.v2ReviewFiles.length, updateState]);

  return { action, run };
}
