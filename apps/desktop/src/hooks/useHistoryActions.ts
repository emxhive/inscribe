import type { AppState } from '@/types';
import { decorateHistoryEntries } from '@/utils';
import { useAppStateContext } from './useAppStateContext';
import { initRepositoryState } from './useRepositoryActions';

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
  request: { repoRoot: string; actionId: string; requestId: string },
): boolean {
  return state.repoRoot === request.repoRoot
    && state.historyReview.actionId === request.actionId
    && state.historyReview.requestId === request.requestId;
}

export function useHistoryActions() {
  const { state, updateState } = useAppStateContext();

  const openRestoreReview = async (actionId: string) => {
    if (!state.repoRoot || state.isRestoringInProgress || state.historyReview.isLoading || state.historyReview.isRestoring) return;

    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
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
      const preview = await window.inscribeAPI.previewRestore(repoRoot, actionId);
      updateState((prev) => {
        if (!isCurrentPreviewRequest(prev, { repoRoot, actionId, requestId })) return {};
        return {
          historyReview: {
            actionId,
            requestId,
            selectedEntryId: preview.files[0]?.entryId ?? null,
            preview,
            isLoading: false,
            isRestoring: false,
            error: preview.error ?? null,
          },
        };
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      updateState((prev) => {
        if (!isCurrentPreviewRequest(prev, { repoRoot, actionId, requestId })) return {};
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
    const actionId = state.historyReview.actionId;
    if (!state.repoRoot || !actionId || !state.historyReview.preview?.eligible || state.isRestoringInProgress) {
      return;
    }

    updateState((prev) => ({
      isRestoringInProgress: true,
      historyReview: { ...prev.historyReview, isRestoring: true, error: null },
      statusMessage: 'Restoring action...',
    }));

    try {
      const result = await window.inscribeAPI.restoreAction(state.repoRoot, actionId);
      if (!result.success) {
        const message = result.errors?.join('; ') || 'restore failed.';
        updateState((prev) => ({
          historyReview: { ...prev.historyReview, isRestoring: false, error: message },
          statusMessage: message,
        }));
        return { status: 'apply-failed' as const, errors: result.errors ?? [] };
      }

      updateState({
        historyItems: decorateHistoryEntries(result.historyEntries ?? []),
        historyReview: EMPTY_HISTORY_REVIEW,
        statusMessage: 'action restored. The restore is recorded in History.',
      });
      await initRepositoryState(state.repoRoot, updateState);
      return { status: 'success' as const };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      updateState((prev) => ({
        historyReview: { ...prev.historyReview, isRestoring: false, error: message },
        statusMessage: message,
      }));
      return { status: 'apply-failed' as const, errors: [message] };
    } finally {
      updateState({ isRestoringInProgress: false });
    }
  };

  return {
    openRestoreReview,
    restoreReviewedAction,
    closeHistoryReview: () => {
      if (state.isRestoringInProgress || state.historyReview.isRestoring) return;
      updateState({ rightPanelOwner: 'history', historyReview: EMPTY_HISTORY_REVIEW });
    },
  };
}
