import {
  extractCliCommandSuggestions,
} from '@inscribe/shared';
import {
  buildApplyFailureUpdate,
  buildApplyFinishedUpdate,
  buildApplyRequestFailureUpdate,
  buildApplyStartedUpdate,
  buildApplySuccessUpdate,
  buildApplyUnavailableUpdate,
  resolveAppliedActionId,
} from '@/state/applyTransitions';
import { decorateHistoryEntries } from '@/utils';
import { selectCanApplyPreview } from '@/state/workflowSelectors';
import { useAppStateContext } from './useAppStateContext';
import { initRepositoryState } from './useRepositoryActions';

/** Applies the immutable preview session as one transaction. */
export function useApplyActions() {
  const { state, updateState } =
    useAppStateContext();

  const handleApplyAll = async () => {
    if (
      !state.repoRoot ||
      state.isApplyingInProgress
    ) {
      return;
    }

    if (!selectCanApplyPreview(state)) {
      updateState(
        buildApplyUnavailableUpdate(
          state.reviewItems.some(
            (item) => item.status === 'applied',
          ),
        ),
      );
      return;
    }

    const repoRoot = state.repoRoot;
    const previewToken =
      state.previewSession!.previewToken;

    updateState(
      buildApplyStartedUpdate(
        state.reviewFiles.length,
      ),
    );

    try {
      const result =
        await window.inscribeAPI.apply({
          repoRoot,
          previewToken,
        });

      if (!result.ok) {
        updateState(
          buildApplyFailureUpdate(
            result.errors,
          ),
        );
        return;
      }

      const appliedActionId =
        resolveAppliedActionId(
          result.historyEntries,
        );

      const newHistoryItems =
        result.historyEntries?.length
          ? decorateHistoryEntries(
              result.historyEntries,
            )
          : [];

      const terminalCommandSuggestions =
        extractCliCommandSuggestions(
          state.aiInput,
        );

      updateState((prev) =>
        buildApplySuccessUpdate({
          reviewItems: state.reviewItems,
          previousHistoryItems:
            prev.historyItems,
          newHistoryItems,
          appliedActionId,
          appliedFileCount:
            result.appliedFileCount,
          terminalCommandSuggestions,
        }),
      );

      await initRepositoryState(
        repoRoot,
        updateState,
      );
    } catch (error) {
      console.error(
        'Failed to apply preview:',
        error,
      );

      updateState(
        buildApplyRequestFailureUpdate(),
      );
    } finally {
      updateState(
        buildApplyFinishedUpdate(),
      );
    }
  };

  return { handleApplyAll };
}