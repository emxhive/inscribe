import type { ApplyResult } from '@inscribe/shared';
import type { AppState, HistoryItem } from '@/types';
import { decorateHistoryEntries } from '@/utils';
import { useAppStateContext } from './useAppStateContext';
import { initRepositoryState } from './useRepositoryActions';

const EMPTY_V2_HISTORY_REVIEW = {
  actionId: null,
  requestId: null,
  preview: null,
  isLoading: false,
  isRestoring: false,
  error: null,
} as const;

export function isCurrentV2PreviewRequest(
  state: Pick<AppState, 'repoRoot' | 'v2HistoryReview'>,
  request: { repoRoot: string; actionId: string; requestId: string },
): boolean {
  return state.repoRoot === request.repoRoot
    && state.v2HistoryReview.actionId === request.actionId
    && state.v2HistoryReview.requestId === request.requestId;
}

export function useHistoryActions() {
  const { state, updateState } = useAppStateContext();

  const updateHistoryItem = (id: string, updates: Partial<HistoryItem>) => {
    updateState((prev) => ({
      historyItems: prev.historyItems.map((item) =>
        item.id === id ? { ...item, ...updates } : item
      ),
    }));
  };

  const restoreItem = async (item: HistoryItem, options?: { preserveRestoreLock?: boolean }) => {
    if (!state.repoRoot || state.isRestoringInProgress || !item.restorePayload) return;

    updateHistoryItem(item.id, { restoreStatus: 'restoring', restoreMessage: undefined });
    updateState({ isRestoringInProgress: true, statusMessage: `Restoring ${item.file}...` });

    try {
      const request = { entryId: item.id };

      // Call internal restore flow
      const result: ApplyResult = await window.inscribeAPI.restoreEntry(request, state.repoRoot);

      if (result.success) {
        const updatedEntry = result.historyEntries?.find((entry) => entry.id === item.id);
        const restoredAt = updatedEntry?.restoredAt ?? new Date().toISOString();
        updateHistoryItem(item.id, {
          restoredAt,
          restoreStatus: 'success',
        });
        if (result.historyEntries) {
          updateState({
            historyItems: decorateHistoryEntries(result.historyEntries),
          });
        }
        updateState({
          statusMessage: `✓ Restored ${item.file}.`,
        });
        const activeLegacyReview = state.legacyHistoryReview;
        await initRepositoryState(state.repoRoot, updateState);
        if (activeLegacyReview.applyId) {
          updateState({ legacyHistoryReview: activeLegacyReview });
        }
        return { status: 'success' as const };
      }

      updateHistoryItem(item.id, {
        restoreStatus: 'apply-failed',
        restoreMessage: result.errors?.join('; ') || 'Restore failed.',
      });
      updateState({
        statusMessage: `Restore failed for ${item.file}: ${result.errors?.join('; ') || 'Unknown error'}`,
      });
      return { status: 'apply-failed' as const, errors: result.errors ?? [] };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      updateHistoryItem(item.id, {
        restoreStatus: 'apply-failed',
        restoreMessage: message,
      });
      updateState({
        statusMessage: `Restore failed for ${item.file}: ${message}`,
      });
      return { status: 'apply-failed' as const, errors: [message] };
    } finally {
      if (!options?.preserveRestoreLock) {
        updateState({ isRestoringInProgress: false });
      }
    }
  };

  const restoreGroup = async (applyId: string) => {
    if (state.isRestoringInProgress) return;
    const items = state.historyItems.filter(
      (item) => item.applyId === applyId && !item.restoredAt
    );
    if (items.length === 0) return;

    updateState({ isRestoringInProgress: true });
    try {
      let successCount = 0;
      let applyFailedCount = 0;

      for (const item of items) {
        const result = await restoreItem(item, { preserveRestoreLock: true });
        if (!result) continue;
        switch (result.status) {
          case 'success':
            successCount += 1;
            break;
          case 'apply-failed':
            applyFailedCount += 1;
            break;
          default:
            break;
        }
      }

      const summaryParts = [
        `${successCount} restored`,
        applyFailedCount ? `${applyFailedCount} failed apply` : null,
      ].filter(Boolean);

      updateState({
        statusMessage: `Restore all complete: ${summaryParts.join(', ')}.`,
      });
    } finally {
      updateState({ isRestoringInProgress: false });
    }
  };

  const openV2RestoreReview = async (actionId: string) => {
    if (!state.repoRoot || state.isRestoringInProgress || state.v2HistoryReview.isLoading || state.v2HistoryReview.isRestoring) return;

    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const repoRoot = state.repoRoot;

    updateState({
      legacyHistoryReview: { applyId: null },
      v2HistoryReview: {
        actionId,
        requestId,
        preview: null,
        isLoading: true,
        isRestoring: false,
        error: null,
      },
    });

    try {
      const preview = await window.inscribeAPI.previewV2Restore(repoRoot, actionId);
      updateState((prev) => {
        if (!isCurrentV2PreviewRequest(prev, { repoRoot, actionId, requestId })) return {};
        return {
          v2HistoryReview: {
            actionId,
            requestId,
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
        if (!isCurrentV2PreviewRequest(prev, { repoRoot, actionId, requestId })) return {};
        return {
          v2HistoryReview: {
            actionId,
            requestId,
            preview: null,
            isLoading: false,
            isRestoring: false,
            error: message,
          },
        };
      });
    }
  };

  const openLegacyHistoryReview = (applyId: string) => {
    if (state.v2HistoryReview.isRestoring || state.isRestoringInProgress) return;
    updateState({
      v2HistoryReview: EMPTY_V2_HISTORY_REVIEW,
      legacyHistoryReview: { applyId },
    });
  };

  const restoreV2ReviewedAction = async () => {
    const actionId = state.v2HistoryReview.actionId;
    if (!state.repoRoot || !actionId || !state.v2HistoryReview.preview?.eligible || state.isRestoringInProgress) {
      return;
    }

    updateState((prev) => ({
      isRestoringInProgress: true,
      v2HistoryReview: { ...prev.v2HistoryReview, isRestoring: true, error: null },
      statusMessage: 'Restoring V2 action...',
    }));

    try {
      const result = await window.inscribeAPI.restoreV2Action(state.repoRoot, actionId);
      if (!result.success) {
        const message = result.errors?.join('; ') || 'V2 restore failed.';
        updateState((prev) => ({
          v2HistoryReview: { ...prev.v2HistoryReview, isRestoring: false, error: message },
          statusMessage: message,
        }));
        return { status: 'apply-failed' as const, errors: result.errors ?? [] };
      }

      updateState({
        historyItems: decorateHistoryEntries(result.historyEntries ?? []),
        v2HistoryReview: {
          actionId: null,
          requestId: null,
          preview: null,
          isLoading: false,
          isRestoring: false,
          error: null,
        },
        statusMessage: 'V2 action restored. The restore is recorded in History.',
      });
      await initRepositoryState(state.repoRoot, updateState);
      return { status: 'success' as const };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      updateState((prev) => ({
        v2HistoryReview: { ...prev.v2HistoryReview, isRestoring: false, error: message },
        statusMessage: message,
      }));
      return { status: 'apply-failed' as const, errors: [message] };
    } finally {
      updateState({ isRestoringInProgress: false });
    }
  };

  return {
    restoreItem,
    restoreGroup,
    openV2RestoreReview,
    openLegacyHistoryReview,
    restoreV2ReviewedAction,
  };
}
