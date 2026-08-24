import { useCallback } from 'react';
import { resolvePrimaryAction, type PrimaryAction } from '@/utils/primaryAction';
import { useAppStateContext } from './useAppStateContext';
import { useApplyActions } from './useApplyActions';
import { useParsingActions } from './useParsingActions';

export function usePrimaryAction(): {
  action: PrimaryAction;
  run: () => void;
} {
  const { state, updateState } = useAppStateContext();
  const { handleParseBlocks } = useParsingActions();
  const { handleApplyAll } = useApplyActions();
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
    }
  }, [action, handleApplyAll, handleParseBlocks, state.v2ReviewFiles.length, updateState]);

  return { action, run };
}
