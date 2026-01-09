/**
 * Apply/Undo/Redo handlers
 */
import { buildApplyPlanFromItems } from '../utils';
import type { ApplyPlan } from '@inscribe/shared';
import {ReviewItem, PipelineStatus} from "@inscribe/desktop/types";


type ApplyStateSetters = {
  setLastAppliedPlan: (plan: ApplyPlan | null) => void;
  setStatusMessage: (message: string) => void;
  clearRedo: () => void;
  setPipelineStatus: (status: PipelineStatus) => void;
  setIsApplyingInProgress: (isInProgress: boolean) => void;
};

export function createApplyHandlers(
  setters: ApplyStateSetters,
  initRepo: (repoRoot: string) => Promise<void>
) {
  const { setLastAppliedPlan, setStatusMessage, clearRedo, setPipelineStatus, setIsApplyingInProgress } = setters;

  const handleApplySelected = async (
    repoRoot: string | null,
    selectedItemId: string | null,
    reviewItems: ReviewItem[]
  ) => {
    if (!repoRoot || !selectedItemId) return;
    
    const selectedItem = reviewItems.find(item => item.id === selectedItemId);
    if (!selectedItem) return;

    if (selectedItem.status === 'invalid') {
      setStatusMessage(`Cannot apply: ${selectedItem.validationError}`);
      return;
    }

    try {
      setIsApplyingInProgress(true);
      setPipelineStatus('applying');
      setStatusMessage('Applying selected file...');
      const plan = buildApplyPlanFromItems([selectedItem]);
      const result = await window.inscribeAPI.applyChanges(plan, repoRoot);
      
      if (result.success) {
        setLastAppliedPlan(plan);
        setPipelineStatus('apply-success');
        setStatusMessage(`✓ Applied: ${selectedItem.file}. Undo restores only the most recent apply batch.`);
        await initRepo(repoRoot); // Refresh state
      } else {
        setPipelineStatus('apply-failure');
        setStatusMessage(`Failed to apply: ${result.errors?.join(', ') || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to apply selected:', error);
      setPipelineStatus('apply-failure');
      setStatusMessage(`Failed to apply: ${error}`);
    } finally {
      setIsApplyingInProgress(false);
    }
  };

  const handleApplyAll = async (repoRoot: string | null, reviewItems: ReviewItem[]) => {
    if (!repoRoot) return;
    
    // Check for invalid items
    const invalidItems = reviewItems.filter(item => item.status === 'invalid');
    if (invalidItems.length > 0) {
      setStatusMessage(`Cannot apply: ${invalidItems.length} file(s) have validation errors`);
      return;
    }

    if (reviewItems.length === 0) {
      setStatusMessage('No files to apply');
      return;
    }

    try {
      setIsApplyingInProgress(true);
      setPipelineStatus('applying');
      setStatusMessage(`Applying ${reviewItems.length} file(s)...`);
      const plan = buildApplyPlanFromItems(reviewItems);
      const result = await window.inscribeAPI.applyChanges(plan, repoRoot);
      
      if (result.success) {
        setLastAppliedPlan(plan);
        setPipelineStatus('apply-success');
        setStatusMessage(`✓ Applied all: ${reviewItems.length} file(s). Undo restores only the most recent apply batch.`);
        await initRepo(repoRoot); // Refresh state
      } else {
        setPipelineStatus('apply-failure');
        setStatusMessage(`Failed to apply: ${result.errors?.join(', ') || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to apply all:', error);
      setPipelineStatus('apply-failure');
      setStatusMessage(`Failed to apply all: ${error}`);
    } finally {
      setIsApplyingInProgress(false);
    }
  };

  const handleApplyValidBlocks = async (repoRoot: string | null, reviewItems: ReviewItem[]) => {
    if (!repoRoot) return;
    
    // Filter only valid items
    const validItems = reviewItems.filter(item => item.status !== 'invalid');
    
    if (validItems.length === 0) {
      setStatusMessage('No valid files to apply');
      return;
    }

    const invalidCount = reviewItems.length - validItems.length;

    try {
      setIsApplyingInProgress(true);
      setPipelineStatus('applying');
      setStatusMessage(`Applying ${validItems.length} valid file(s)...`);
      const plan = buildApplyPlanFromItems(validItems);
      const result = await window.inscribeAPI.applyChanges(plan, repoRoot);
      
      if (result.success) {
        setLastAppliedPlan(plan);
        setPipelineStatus('apply-success');
        if (invalidCount > 0) {
          setStatusMessage(`✓ Applied ${validItems.length} valid file(s). ${invalidCount} file(s) with errors were skipped.`);
        } else {
          setStatusMessage(`✓ Applied all: ${validItems.length} file(s).`);
        }
        await initRepo(repoRoot); // Refresh state
      } else {
        setPipelineStatus('apply-failure');
        setStatusMessage(`Failed to apply: ${result.errors?.join(', ') || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to apply valid blocks:', error);
      setPipelineStatus('apply-failure');
      setStatusMessage(`Failed to apply valid blocks: ${error}`);
    } finally {
      setIsApplyingInProgress(false);
    }
  };

  const handleUndo = async (repoRoot: string | null) => {
    if (!repoRoot) return;
    
    try {
      setStatusMessage('Undoing last apply...');
      const result = await window.inscribeAPI.undoLastApply(repoRoot);
      
      if (result.success) {
        // Keep the plan for redo
        setStatusMessage(`✓ Undo successful: ${result.message} (Undo restores only the most recent apply batch.)`);
        await initRepo(repoRoot); // Refresh state
      } else {
        setStatusMessage(`Undo failed: ${result.message}`);
      }
    } catch (error) {
      console.error('Failed to undo:', error);
      setStatusMessage(`Failed to undo: ${error}`);
    }
  };

  const handleRedo = async (repoRoot: string | null, lastAppliedPlan: ApplyPlan | null) => {
    if (!repoRoot || !lastAppliedPlan) return;
    
    try {
      setStatusMessage('Redoing last apply...');
      const result = await window.inscribeAPI.applyChanges(lastAppliedPlan, repoRoot);
      
      if (result.success) {
        clearRedo();
        setStatusMessage('✓ Redo successful');
        await initRepo(repoRoot); // Refresh state
      } else {
        setStatusMessage(`Redo failed: ${result.errors?.join(', ') || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to redo:', error);
      setStatusMessage(`Failed to redo: ${error}`);
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
