import { buildApplyPlanFromItems } from '@/utils';
import type { ReviewItem } from '@/types';
import { useAppStateContext } from './useAppStateContext';
import { initRepositoryState } from './useRepositoryActions';

/**
 * Hook for apply/undo/redo operations
 */
export function useApplyActions() {
  const { state, updateState, setLastAppliedPlan, clearRedo } = useAppStateContext();
  const refreshRepo = async (repoRoot: string) => {
    await initRepositoryState(repoRoot, updateState);
  };
  const markItemsApplied = (ids: string[]) => {
    const appliedStatus: ReviewItem['status'] = 'applied';
    updateState((prev) => ({
      reviewItems: prev.reviewItems.map((item) =>
        ids.includes(item.id) ? { ...item, status: appliedStatus } : item
      ),
    }));
  };
  const handleApplySelected = async () => {
    if (!state.repoRoot || !state.selectedItemId) return;
    
    const selectedItem = state.reviewItems.find(item => item.id === state.selectedItemId);
    if (!selectedItem) return;

    if (selectedItem.status === 'invalid') {
      updateState({ statusMessage: `Cannot apply: ${selectedItem.validationError}` });
      return;
    }
    if (selectedItem.status === 'applied') {
      updateState({ statusMessage: 'Selected file has already been applied' });
      return;
    }

    try {
      updateState({
        isApplyingInProgress: true,
        pipelineStatus: 'applying',
        statusMessage: 'Applying selected file...'
      });

      const plan = buildApplyPlanFromItems([selectedItem]);
      const result = await window.inscribeAPI.applyChanges(plan, state.repoRoot);
      
      if (result.success) {
        setLastAppliedPlan(plan);
        markItemsApplied([selectedItem.id]);
        updateState({
          pipelineStatus: 'apply-success',
          statusMessage: `✓ Applied: ${selectedItem.file}. Undo restores only the most recent apply batch.`
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
        statusMessage: `Applying ${pendingItems.length} file(s)...`
      });

      const plan = buildApplyPlanFromItems(pendingItems);
      const result = await window.inscribeAPI.applyChanges(plan, state.repoRoot);
      
      if (result.success) {
        setLastAppliedPlan(plan);
        markItemsApplied(pendingItems.map((item) => item.id));
        updateState({
          pipelineStatus: 'apply-success',
          statusMessage: `✓ Applied all: ${pendingItems.length} file(s). Undo restores only the most recent apply batch.`
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
        statusMessage: `Applying ${pendingItems.length} valid file(s)...`
      });

      const plan = buildApplyPlanFromItems(pendingItems);
      const result = await window.inscribeAPI.applyChanges(plan, state.repoRoot);
      
      if (result.success) {
        setLastAppliedPlan(plan);
        markItemsApplied(pendingItems.map((item) => item.id));
        const message = invalidCount > 0
          ? `✓ Applied ${pendingItems.length} valid file(s). ${invalidCount} file(s) with errors were skipped.`
          : `✓ Applied all: ${pendingItems.length} file(s).`;
        
        updateState({
          pipelineStatus: 'apply-success',
          statusMessage: message
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

  const handleUndo = async () => {
    if (!state.repoRoot) return;
    
    try {
      updateState({
        isApplyingInProgress: true,
        pipelineStatus: 'applying',
        statusMessage: 'Undoing last apply...'
      });

      const result = await window.inscribeAPI.undoLastApply(state.repoRoot);
      
      if (result.success) {
        updateState({
          pipelineStatus: 'apply-success',
          statusMessage: `✓ Undo successful: ${result.message} (Undo restores only the most recent apply batch.)`
        });
        await refreshRepo(state.repoRoot);
      } else {
        updateState({
          pipelineStatus: 'apply-failure',
          statusMessage: `Undo failed: ${result.message}`
        });
      }
    } catch (error) {
      console.error('Failed to undo:', error);
      updateState({
        pipelineStatus: 'apply-failure',
        statusMessage: `Failed to undo: ${error}`
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
        statusMessage: 'Redoing last apply...'
      });

      const result = await window.inscribeAPI.applyChanges(state.lastAppliedPlan, state.repoRoot);
      
      if (result.success) {
        clearRedo();
        updateState({
          pipelineStatus: 'apply-success',
          statusMessage: '✓ Redo successful'
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

  return {
    handleApplySelected,
    handleApplyAll,
    handleApplyValidBlocks,
    handleUndo,
    handleRedo,
  };
}
