import { useRef } from 'react';
import {
  normalizeRelativePath,
} from '@inscribe/shared';
import {
  buildHistoryPreviewFailedUpdate,
  buildHistoryPreviewResolvedUpdate,
  buildHistoryPreviewStartedUpdate,
  buildHistoryRestoreFailedUpdate,
  buildHistoryRestoreRefreshFailedUpdate,
  buildHistoryRestoreStartedUpdate,
  buildHistoryRestoreSuccessUpdate,
  buildHistoryReviewClosedUpdate,
  buildImmediateRevertFailedUpdate,
  buildImmediateRevertIntakeChangedUpdate,
  buildImmediateRevertRefreshFailedUpdate,
  buildImmediateRevertRepositoryChangedUpdate,
  buildImmediateRevertStartedUpdate,
  buildImmediateRevertSuccessUpdate,
  buildRestoreFinishedUpdate,
  isCurrentHistoryPreviewRequest,
} from '@/state/historyTransitions';
import { decorateHistoryEntries } from '@/utils';
import { selectCanRevertLastAppliedAction } from '@/state/workflowSelectors';
import { useAppStateContext } from './useAppStateContext';
import { initRepositoryState } from './useRepositoryActions';
import { previewIntake } from './useParsingActions';

function errorMessage(
  error: unknown,
): string {
  return error instanceof Error
    ? error.message
    : String(error);
}

export function useHistoryActions() {
  const { state, updateState } =
    useAppStateContext();

  const stateRef = useRef(state);
  stateRef.current = state;

  const openRestoreReview = async (
    actionId: string,
  ) => {
    if (
      !state.repoRoot ||
      state.isRestoringInProgress ||
      state.historyReview.isLoading ||
      state.historyReview.isRestoring
    ) {
      return;
    }

    const requestId = `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 10)}`;

    const repoRoot = state.repoRoot;

    updateState(
      buildHistoryPreviewStartedUpdate(
        actionId,
        requestId,
      ),
    );

    try {
      const preview =
        await window.inscribeAPI.previewRestore(
          repoRoot,
          actionId,
        );

      updateState((prev) => {
        if (
          !isCurrentHistoryPreviewRequest(
            prev,
            {
              repoRoot,
              actionId,
              requestId,
            },
          )
        ) {
          return {};
        }

        return buildHistoryPreviewResolvedUpdate(
          actionId,
          requestId,
          preview,
        );
      });
    } catch (error) {
      const message =
        errorMessage(error);

      updateState((prev) => {
        if (
          !isCurrentHistoryPreviewRequest(
            prev,
            {
              repoRoot,
              actionId,
              requestId,
            },
          )
        ) {
          return {};
        }

        return buildHistoryPreviewFailedUpdate(
          actionId,
          requestId,
          message,
        );
      });
    }
  };

  const restoreReviewedAction = async () => {
    const actionId =
      state.historyReview.actionId;

    if (
      !state.repoRoot ||
      !actionId ||
      !state.historyReview.preview?.eligible ||
      state.isRestoringInProgress
    ) {
      return;
    }

    const repoRoot = state.repoRoot;

    updateState((prev) =>
      buildHistoryRestoreStartedUpdate(
        prev.historyReview,
      ),
    );

    try {
      const result =
        await window.inscribeAPI.restoreAction(
          repoRoot,
          actionId,
        );

      if (!result.success) {
        const message =
          result.errors?.join('; ') ||
          'restore failed.';

        updateState((prev) =>
          buildHistoryRestoreFailedUpdate(
            prev.historyReview,
            message,
          ),
        );

        return {
          status: 'apply-failed' as const,
          errors: result.errors ?? [],
        };
      }

      updateState(
        buildHistoryRestoreSuccessUpdate(
          decorateHistoryEntries(
            result.historyEntries ?? [],
          ),
        ),
      );

      try {
        await initRepositoryState(
          repoRoot,
          updateState,
        );
      } catch (error) {
        updateState(
          buildHistoryRestoreRefreshFailedUpdate(
            errorMessage(error),
          ),
        );
      }

      return {
        status: 'success' as const,
      };
    } catch (error) {
      const message =
        errorMessage(error);

      updateState((prev) =>
        buildHistoryRestoreFailedUpdate(
          prev.historyReview,
          message,
        ),
      );

      return {
        status: 'apply-failed' as const,
        errors: [message],
      };
    } finally {
      updateState(
        buildRestoreFinishedUpdate(),
      );
    }
  };

  const revertLastAppliedAction = async () => {
    const actionId =
      state.lastAppliedActionId;

    const canRevert =
      selectCanRevertLastAppliedAction(
        state,
      );

    if (
      !canRevert ||
      !state.repoRoot ||
      !actionId
    ) {
      return;
    }

    const repoRoot = state.repoRoot;
    const rawInput = state.aiInput;
    const selectedIntakeBlockId =
      state.selectedIntakeBlockId;

    updateState(
      buildImmediateRevertStartedUpdate(),
    );

    try {
      const result =
        await window.inscribeAPI.restoreAction(
          repoRoot,
          actionId,
        );

      if (!result.success) {
        const message =
          result.errors?.join('; ') ||
          'revert failed.';

        updateState(
          buildImmediateRevertFailedUpdate(
            message,
          ),
        );

        return {
          status: 'apply-failed' as const,
          errors: result.errors ?? [],
        };
      }

      updateState(
        buildImmediateRevertSuccessUpdate(
          decorateHistoryEntries(
            result.historyEntries ?? [],
          ),
        ),
      );

      if (
        stateRef.current.repoRoot !==
        repoRoot
      ) {
        updateState(
          buildImmediateRevertRepositoryChangedUpdate(),
        );

        return {
          status: 'success' as const,
        };
      }

      let repoState;

      try {
        repoState =
          await initRepositoryState(
            repoRoot,
            updateState,
          );
      } catch (error) {
        updateState(
          buildImmediateRevertRefreshFailedUpdate(
            errorMessage(error),
          ),
        );

        return {
          status: 'success' as const,
        };
      }

      if (
        stateRef.current.aiInput !==
        rawInput
      ) {
        updateState(
          buildImmediateRevertIntakeChangedUpdate(),
        );

        return {
          status: 'success' as const,
        };
      }

      const indexedFileSet = new Set(
        repoState.indexedFiles.map(
          normalizeRelativePath,
        ),
      );

      await previewIntake({
        repoRoot,
        rawInput,
        indexedFileSet,
        selectedIntakeBlockId,
        updateState,
        startStatusMessage:
          'Changes reverted. Rebuilding preview...',
      });

      return {
        status: 'success' as const,
      };
    } catch (error) {
      const message =
        errorMessage(error);

      updateState(
        buildImmediateRevertFailedUpdate(
          message,
        ),
      );

      return {
        status: 'apply-failed' as const,
        errors: [message],
      };
    } finally {
      updateState(
        buildRestoreFinishedUpdate(),
      );
    }
  };

  return {
    openRestoreReview,
    restoreReviewedAction,
    revertLastAppliedAction,
    closeHistoryReview: () => {
      if (
        state.isRestoringInProgress ||
        state.historyReview.isRestoring
      ) {
        return;
      }

      updateState(
        buildHistoryReviewClosedUpdate(),
      );
    },
  };
}