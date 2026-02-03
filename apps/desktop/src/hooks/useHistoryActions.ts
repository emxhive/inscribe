import type { ApplyPlan, ParsedBlock } from '@inscribe/shared';
import type { HistoryItem, RestoreStatus } from '@/types';
import { useAppStateContext } from './useAppStateContext';
import { initRepositoryState } from './useRepositoryActions';

function buildRestoreBlock(item: HistoryItem): ParsedBlock {
  return {
    file: item.restoreOperation.file,
    mode: item.restoreOperation.type,
    directives: item.restoreOperation.directives ?? {},
    content: item.restoreOperation.content,
    blockIndex: item.blockIndex ?? 0,
  };
}

function resolveRestoreStatus(errors: string[]): RestoreStatus {
  if (errors.some((error) => error.startsWith('Unsafe to restore'))) {
    return 'unsafe';
  }
  return 'validation-failed';
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

  const restoreItem = async (item: HistoryItem) => {
    if (!state.repoRoot || state.isRestoringInProgress) return;

    updateHistoryItem(item.id, { restoreStatus: 'restoring', restoreMessage: undefined });
    updateState({ isRestoringInProgress: true, statusMessage: 'Validating restore...' });

    try {
      const restoreBlock = buildRestoreBlock(item);
      const validationErrors = await window.inscribeAPI.validateBlocks(
        [restoreBlock],
        state.repoRoot
      );

      if (validationErrors.length > 0) {
        const errorMessages = validationErrors.map((error) => error.message);
        const status = resolveRestoreStatus(errorMessages);
        updateHistoryItem(item.id, {
          restoreStatus: status,
          restoreMessage: errorMessages.join('; '),
        });
        updateState({
          statusMessage:
            status === 'unsafe'
              ? `Unsafe to restore ${item.file}: ${errorMessages.join('; ')}`
              : `Restore validation failed for ${item.file}: ${errorMessages.join('; ')}`,
        });
        return { status, errors: errorMessages };
      }

      updateState({ statusMessage: `Restoring ${item.file}...` });
      const plan: ApplyPlan = { operations: [item.restoreOperation] };
      const result = await window.inscribeAPI.applyChanges(plan, state.repoRoot);

      if (result.success) {
        const restoredAt = new Date().toISOString();
        updateHistoryItem(item.id, {
          restoredAt,
          restoreStatus: 'success',
        });
        await window.inscribeAPI.markHistoryEntryRestored(state.repoRoot, item.id, restoredAt);
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
    let unsafeCount = 0;
    let validationCount = 0;
    let applyFailedCount = 0;

    for (const item of items) {
      const result = await restoreItem(item);
      if (!result) continue;
      switch (result.status) {
        case 'success':
          successCount += 1;
          break;
        case 'unsafe':
          unsafeCount += 1;
          break;
        case 'validation-failed':
          validationCount += 1;
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
      unsafeCount ? `${unsafeCount} unsafe` : null,
      validationCount ? `${validationCount} failed validation` : null,
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
