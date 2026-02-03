import type { HistoryEntry } from '@inscribe/shared';
import { buildApplyPlanFromItems, getLanguageFromFilename } from '@/utils';
import type { HistoryItem, ReviewItem } from '@/types';
import { useAppStateContext } from './useAppStateContext';
import { initRepositoryState } from './useRepositoryActions';
import { useHistoryActions } from './useHistoryActions';

/**
 * Hook for apply/redo operations
 */
export function useApplyActions() {
  const { state, updateState, setLastAppliedPlan, clearRedo } = useAppStateContext();
  const { restoreGroup } = useHistoryActions();
  const decorateHistoryEntries = (entries: HistoryEntry[]): HistoryItem[] =>
    entries.map((entry) => {
      const file = entry.restoreOperation?.file ?? entry.file;
      const mode = entry.restoreOperation?.type ?? entry.mode;
      const content = entry.restoreOperation?.content ?? '';
      return {
        ...entry,
        restoreMeta: {
          file,
          lineCount: content ? content.split('\n').length : 0,
          language: getLanguageFromFilename(file),
          mode,
        },
      };
    });
  const refreshRepo = async (repoRoot: string) => {
    await initRepositoryState(repoRoot, updateState);
  };
  const markItemsApplied = (ids: string[]) => {
    const appliedStatus: ReviewItem['status'] = 'applied';
    updateState((prev) => {
      const nextReviewItems = prev.reviewItems.map((item) =>
        ids.includes(item.id) ? { ...item, status: appliedStatus } : item
      );
      const selectedWasApplied = prev.selectedItemId ? ids.includes(prev.selectedItemId) : false;
      return {
        reviewItems: nextReviewItems,
        ...(selectedWasApplied ? { isEditing: false } : {}),
      };
    });
  };
  const handleApplySelected = async () => {
    if (!state.repoRoot || !state.selectedItemId) return;
    
    const selectedItem = state.reviewItems.find(item => item.id === state.selectedItemId);
    if (!selectedItem) return;

    if (selectedItem.status === 'invalid') {
      updateState({ statusMessage: `Cannot apply: ${selectedItem.validationError}` });
      return;
    }
    if (selectedItem.status !== 'pending') {
      updateState({ statusMessage: 'Selected file is not pending' });
      return;
    }

    try {
      updateState({
        isApplyingInProgress: true,
        pipelineStatus: 'applying',
        statusMessage: 'Applying selected file...',
        canUndoApply: false,
        lastApplyId: null,
      });

      const plan = buildApplyPlanFromItems([selectedItem]);
      const result = await window.inscribeAPI.applyChanges(plan, state.repoRoot);
      
      if (result.historyEntries?.length) {
        updateState((prev) => ({
          historyItems: [
            ...decorateHistoryEntries(result.historyEntries),
            ...prev.historyItems,
          ],
        }));
      }

      if (result.success) {
        setLastAppliedPlan(plan);
        const applyId = result.historyEntries?.[0]?.applyId ?? null;
        markItemsApplied([selectedItem.id]);
        updateState({
          pipelineStatus: 'apply-success',
          statusMessage: `✓ Applied: ${selectedItem.file}.`,
          canUndoApply: Boolean(applyId),
          lastApplyId: applyId,
          canRedo: true,
        });
        await refreshRepo(state.repoRoot);
      } else {
        updateState({
          pipelineStatus: 'apply-failure',
          statusMessage: `Failed to apply: ${result.errors?.join(', ') || 'Unknown error'}`
        });
      }
    } catch (error) {
      console.error('Failed to apply selected:', error);
      updateState({
        pipelineStatus: 'apply-failure',
        statusMessage: `Failed to apply: ${error}`
      });
    } finally {
      updateState({ isApplyingInProgress: false });
    }
  };

  const handleApplyAll = async () => {
    if (!state.repoRoot) return;
    
    const hasAnyApplied = state.reviewItems.some(item => item.status === 'applied');
    if (hasAnyApplied) {
      updateState({ statusMessage: 'Some files have already been applied' });
      return;
    }

    const invalidItems = state.reviewItems.filter(item => item.status === 'invalid');
    if (invalidItems.length > 0) {
      updateState({ statusMessage: `Cannot apply: ${invalidItems.length} file(s) have validation errors` });
      return;
    }

    const pendingItems = state.reviewItems.filter(item => item.status === 'pending');
    if (pendingItems.length === 0) {
      updateState({ statusMessage: 'No pending files to apply' });
      return;
    }

    try {
      updateState({
        isApplyingInProgress: true,
        pipelineStatus: 'applying',
        statusMessage: `Applying ${pendingItems.length} file(s)...`,
        canUndoApply: false,
        lastApplyId: null,
      });

      const plan = buildApplyPlanFromItems(pendingItems);
      const result = await window.inscribeAPI.applyChanges(plan, state.repoRoot);
      
      if (result.historyEntries?.length) {
        updateState((prev) => ({
          historyItems: [
            ...decorateHistoryEntries(result.historyEntries),
            ...prev.historyItems,
          ],
        }));
      }

      if (result.success) {
        setLastAppliedPlan(plan);
        const applyId = result.historyEntries?.[0]?.applyId ?? null;
        markItemsApplied(pendingItems.map((item) => item.id));
        updateState({
          pipelineStatus: 'apply-success',
          statusMessage: `✓ Applied all: ${pendingItems.length} file(s).`,
          canUndoApply: Boolean(applyId),
          lastApplyId: applyId,
          canRedo: true,
        });
        await refreshRepo(state.repoRoot);
      } else {
        updateState({
          pipelineStatus: 'apply-failure',
          statusMessage: `Failed to apply: ${result.errors?.join(', ') || 'Unknown error'}`
        });
      }
    } catch (error) {
      console.error('Failed to apply all:', error);
      updateState({
        pipelineStatus: 'apply-failure',
        statusMessage: `Failed to apply all: ${error}`
      });
    } finally {
      updateState({ isApplyingInProgress: false });
    }
  };

  const handleApplyValidBlocks = async () => {
    if (!state.repoRoot) return;
    
    const pendingItems = state.reviewItems.filter(item => item.status === 'pending');
    
    if (pendingItems.length === 0) {
      updateState({ 
        statusMessage: 'No pending valid files to apply',
        pipelineStatus: 'idle'
      });
      return;
    }

    const invalidCount = state.reviewItems.filter(item => item.status === 'invalid').length;

    try {
      updateState({
        isApplyingInProgress: true,
        pipelineStatus: 'applying',
        statusMessage: `Applying ${pendingItems.length} valid file(s)...`,
        canUndoApply: false,
        lastApplyId: null,
      });

      const plan = buildApplyPlanFromItems(pendingItems);
      const result = await window.inscribeAPI.applyChanges(plan, state.repoRoot);
      
      if (result.historyEntries?.length) {
        updateState((prev) => ({
          historyItems: [
            ...decorateHistoryEntries(result.historyEntries),
            ...prev.historyItems,
          ],
        }));
      }

      if (result.success) {
        setLastAppliedPlan(plan);
        const applyId = result.historyEntries?.[0]?.applyId ?? null;
        markItemsApplied(pendingItems.map((item) => item.id));
        const message = invalidCount > 0
          ? `✓ Applied ${pendingItems.length} valid file(s). ${invalidCount} file(s) with errors were skipped.`
          : `✓ Applied all: ${pendingItems.length} file(s).`;
        
        updateState({
          pipelineStatus: 'apply-success',
          statusMessage: message,
          canUndoApply: Boolean(applyId),
          lastApplyId: applyId,
          canRedo: true,
        });
        await refreshRepo(state.repoRoot);
      } else {
        updateState({
          pipelineStatus: 'apply-failure',
          statusMessage: `Failed to apply: ${result.errors?.join(', ') || 'Unknown error'}`
        });
      }
    } catch (error) {
      console.error('Failed to apply valid blocks:', error);
      updateState({
        pipelineStatus: 'apply-failure',
        statusMessage: `Failed to apply valid blocks: ${error}`
      });
    } finally {
      updateState({ isApplyingInProgress: false });
    }
  };

  const handleRedo = async () => {
    if (!state.repoRoot || !state.lastAppliedPlan) return;
    
    try {
      updateState({
        isApplyingInProgress: true,
        pipelineStatus: 'applying',
        statusMessage: 'Redoing last apply...',
        canUndoApply: false,
        lastApplyId: null,
      });

      const result = await window.inscribeAPI.applyChanges(state.lastAppliedPlan, state.repoRoot);

      if (result.historyEntries?.length) {
        updateState((prev) => ({
          historyItems: [
            ...decorateHistoryEntries(result.historyEntries),
            ...prev.historyItems,
          ],
        }));
      }

      if (result.success) {
        clearRedo();
        const applyId = result.historyEntries?.[0]?.applyId ?? null;
        updateState({
          pipelineStatus: 'apply-success',
          statusMessage: '✓ Redo successful',
          canUndoApply: Boolean(applyId),
          lastApplyId: applyId,
        });
        await refreshRepo(state.repoRoot);
      } else {
        updateState({
          pipelineStatus: 'apply-failure',
          statusMessage: `Redo failed: ${result.errors?.join(', ') || 'Unknown error'}`
        });
      }
    } catch (error) {
      console.error('Failed to redo:', error);
      updateState({
        pipelineStatus: 'apply-failure',
        statusMessage: `Failed to redo: ${error}`
      });
    } finally {
      updateState({ isApplyingInProgress: false });
    }
  };

  const handleUndoApply = async () => {
    if (!state.repoRoot || !state.canUndoApply || !state.lastApplyId) return;
    if (state.isApplyingInProgress || state.isRestoringInProgress) return;

    await restoreGroup(state.lastApplyId);
    updateState((prev) => ({
      canUndoApply: false,
      lastApplyId: null,
      canRedo: prev.lastAppliedPlan ? true : prev.canRedo,
    }));
  };

  return {
    handleApplySelected,
    handleApplyAll,
    handleApplyValidBlocks,
    handleRedo,
    handleUndoApply,
  };
}
