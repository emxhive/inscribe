import { useRef } from 'react';
import { normalizeRelativePath } from '@inscribe/shared';
import type { AppState } from '@/types';
import { decorateHistoryEntries } from '@/utils';
import { useAppStateContext } from './useAppStateContext';
import { initRepositoryState } from './useRepositoryActions';
import { previewIntake } from './useParsingActions';

const EMPTY_HISTORY_REVIEW = {
  actionId: null,
  requestId: null,
  selectedEntryId: null,
  preview: null,
  isLoading: false,
  isRestoring: false,
  error: null,
} as const;

export function isCurrentPreviewRequest(
  state: Pick<AppState, 'repoRoot' | 'historyReview'>,
  request: {
    repoRoot: string;
    actionId: string;
    requestId: string;
  },
): boolean {
  return (
    state.repoRoot === request.repoRoot &&
    state.historyReview.actionId === request.actionId &&
    state.historyReview.requestId === request.requestId
  );
}

export function useHistoryActions() {
  const { state, updateState } = useAppStateContext();
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

    updateState({
      historyReview: {
        actionId,
        requestId,
        selectedEntryId: null,
        preview: null,
        isLoading: true,
        isRestoring: false,
        error: null,
      },
    });

    try {
      const preview =
        await window.inscribeAPI.previewRestore(
          repoRoot,
          actionId,
        );

      updateState((prev) => {
        if (
          !isCurrentPreviewRequest(prev, {
            repoRoot,
            actionId,
            requestId,
          })
        ) {
          return {};
        }

        return {
          historyReview: {
            actionId,
            requestId,
            selectedEntryId:
              preview.files[0]?.entryId ?? null,
            preview,
            isLoading: false,
            isRestoring: false,
            error: preview.error ?? null,
          },
        };
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : String(error);

      updateState((prev) => {
        if (
          !isCurrentPreviewRequest(prev, {
            repoRoot,
            actionId,
            requestId,
          })
        ) {
          return {};
        }

        return {
          historyReview: {
            actionId,
            requestId,
            selectedEntryId: null,
            preview: null,
            isLoading: false,
            isRestoring: false,
            error: message,
          },
        };
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

    updateState((prev) => ({
      isRestoringInProgress: true,
      historyReview: {
        ...prev.historyReview,
        isRestoring: true,
        error: null,
      },
      statusMessage: 'Restoring action...',
    }));

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

        updateState((prev) => ({
          historyReview: {
            ...prev.historyReview,
            isRestoring: false,
            error: message,
          },
          statusMessage: message,
        }));

        return {
          status: 'apply-failed' as const,
          errors: result.errors ?? [],
        };
      }

      updateState({
        historyItems: decorateHistoryEntries(
          result.historyEntries ?? [],
        ),
        historyReview: EMPTY_HISTORY_REVIEW,
        lastAppliedActionId: null,
        statusMessage:
          'action restored. The restore is recorded in History.',
      });

      await initRepositoryState(
        repoRoot,
        updateState,
      );

      return { status: 'success' as const };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : String(error);

      updateState((prev) => ({
        historyReview: {
          ...prev.historyReview,
          isRestoring: false,
          error: message,
        },
        statusMessage: message,
      }));

      return {
        status: 'apply-failed' as const,
        errors: [message],
      };
    } finally {
      updateState({
        isRestoringInProgress: false,
      });
    }
  };

  const revertLastAppliedAction = async () => {
    const actionId =
      state.lastAppliedActionId;

    const canRevert =
      Boolean(state.repoRoot) &&
      Boolean(actionId) &&
      state.mode === 'review' &&
      state.reviewItems.length > 0 &&
      state.reviewItems.every(
        (item) => item.status === 'applied',
      ) &&
      !state.isParsingInProgress &&
      !state.isApplyingInProgress &&
      !state.isRestoringInProgress &&
      !state.historyReview.actionId;

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

    updateState({
      isRestoringInProgress: true,
      pipelineStatus: 'idle',
      statusMessage: 'Reverting changes...',
    });

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

        updateState({
          statusMessage:
            `Unable to revert changes: ${message}`,
        });

        return {
          status: 'apply-failed' as const,
          errors: result.errors ?? [],
        };
      }

      updateState({
        historyItems: decorateHistoryEntries(
          result.historyEntries ?? [],
        ),
        lastAppliedActionId: null,
        statusMessage:
          'Changes reverted. Rebuilding preview...',
      });

      if (
        stateRef.current.repoRoot !== repoRoot
      ) {
        return { status: 'success' as const };
      }

      const repoState =
        await initRepositoryState(
          repoRoot,
          updateState,
        );

      if (
        stateRef.current.aiInput !== rawInput
      ) {
        updateState({
          statusMessage:
            'Changes reverted. Intake changed during the revert; preview again to review it.',
        });

        return { status: 'success' as const };
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

      return { status: 'success' as const };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : String(error);

      updateState({
        statusMessage:
          `Unable to revert changes: ${message}`,
      });

      return {
        status: 'apply-failed' as const,
        errors: [message],
      };
    } finally {
      updateState({
        isRestoringInProgress: false,
      });
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

      updateState({
        rightPanelOwner: 'history',
        historyReview: EMPTY_HISTORY_REVIEW,
      });
    },
  };
}