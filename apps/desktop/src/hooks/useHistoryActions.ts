import type { ApplyResult } from '@inscribe/shared';
import type { HistoryItem } from '@/types';
import { decorateHistoryEntries } from '@/utils';
import { useAppStateContext } from './useAppStateContext';
import { initRepositoryState } from './useRepositoryActions';

export function useHistoryActions() {
  const { state, updateState } = useAppStateContext();

  const updateHistoryItem = (id: string, updates: Partial<HistoryItem>) => {
    updateState((prev) => ({
      historyItems: prev.historyItems.map((item) =>
        item.id === id ? { ...item, ...updates } : item
      ),
    }));
  };

  const restoreItem = async (item: HistoryItem) => {
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
        await initRepositoryState(state.repoRoot, updateState);
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
      updateState({ isRestoringInProgress: false });
    }
  };

  const restoreGroup = async (applyId: string) => {
    const items = state.historyItems.filter(
      (item) => item.applyId === applyId && !item.restoredAt
    );
    if (items.length === 0) return;

    let successCount = 0;
    let applyFailedCount = 0;

    for (const item of items) {
      const result = await restoreItem(item);
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
  };

  return {
    restoreItem,
    restoreGroup,
  };
}
