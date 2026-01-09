import { useCallback } from 'react';
import { buildApplyPlanFromItems } from '../utils';
import type { AppState } from '../types';

/**
 * Hook for apply/undo/redo operations
 */
export function useApplyActions(
  state: AppState,
  updateState: (updates: Partial<AppState>) => void,
  setLastAppliedPlan: (plan: any) => void,
  clearRedo: () => void,
  initRepo: (repoRoot: string) => Promise<void>
) {
  const handleApplySelected = useCallback(async () => {
    if (!state.repoRoot || !state.selectedItemId) return;
    
    const selectedItem = state.reviewItems.find(item => item.id === state.selectedItemId);
    if (!selectedItem) return;

    if (selectedItem.status === 'invalid') {
      updateState({ statusMessage: `Cannot apply: ${selectedItem.validationError}` });
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
        updateState({
          pipelineStatus: 'apply-success',
          statusMessage: `✓ Applied: ${selectedItem.file}. Undo restores only the most recent apply batch.`
        });
        await initRepo(state.repoRoot);
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
  }, [state.repoRoot, state.selectedItemId, state.reviewItems, updateState, setLastAppliedPlan, initRepo]);

  const handleApplyAll = useCallback(async () => {
    if (!state.repoRoot) return;
    
    const invalidItems = state.reviewItems.filter(item => item.status === 'invalid');
    if (invalidItems.length > 0) {
      updateState({ statusMessage: `Cannot apply: ${invalidItems.length} file(s) have validation errors` });
      return;
    }

    if (state.reviewItems.length === 0) {
      updateState({ statusMessage: 'No files to apply' });
      return;
    }

    try {
      updateState({
        isApplyingInProgress: true,
        pipelineStatus: 'applying',
        statusMessage: `Applying ${state.reviewItems.length} file(s)...`
      });

      const plan = buildApplyPlanFromItems(state.reviewItems);
      const result = await window.inscribeAPI.applyChanges(plan, state.repoRoot);
      
      if (result.success) {
        setLastAppliedPlan(plan);
        updateState({
          pipelineStatus: 'apply-success',
          statusMessage: `✓ Applied all: ${state.reviewItems.length} file(s). Undo restores only the most recent apply batch.`
        });
        await initRepo(state.repoRoot);
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
  }, [state.repoRoot, state.reviewItems, updateState, setLastAppliedPlan, initRepo]);

  const handleApplyValidBlocks = useCallback(async () => {
    if (!state.repoRoot) return;
    
    const validItems = state.reviewItems.filter(item => item.status !== 'invalid');
    
    if (validItems.length === 0) {
      updateState({ 
        statusMessage: 'No valid files to apply',
        pipelineStatus: 'idle'
      });
      return;
    }

    const invalidCount = state.reviewItems.length - validItems.length;

    try {
      updateState({
        isApplyingInProgress: true,
        pipelineStatus: 'applying',
        statusMessage: `Applying ${validItems.length} valid file(s)...`
      });

      const plan = buildApplyPlanFromItems(validItems);
      const result = await window.inscribeAPI.applyChanges(plan, state.repoRoot);
      
      if (result.success) {
        setLastAppliedPlan(plan);
        const message = invalidCount > 0
          ? `✓ Applied ${validItems.length} valid file(s). ${invalidCount} file(s) with errors were skipped.`
          : `✓ Applied all: ${validItems.length} file(s).`;
        
        updateState({
          pipelineStatus: 'apply-success',
          statusMessage: message
        });
        await initRepo(state.repoRoot);
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
  }, [state.repoRoot, state.reviewItems, updateState, setLastAppliedPlan, initRepo]);

  const handleUndo = useCallback(async () => {
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
        await initRepo(state.repoRoot);
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
  }, [state.repoRoot, updateState, initRepo]);

  const handleRedo = useCallback(async () => {
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
        await initRepo(state.repoRoot);
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
  }, [state.repoRoot, state.lastAppliedPlan, updateState, clearRedo, initRepo]);

  return {
    handleApplySelected,
    handleApplyAll,
    handleApplyValidBlocks,
    handleUndo,
    handleRedo,
  };
}
