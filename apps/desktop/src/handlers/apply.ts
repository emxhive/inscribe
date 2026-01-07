/**
 * Apply/Undo/Redo handlers
 */
import { buildApplyPlanFromItems } from '../utils';
import type { ReviewItem } from '../useAppState';

type ApplyStateSetters = {
  setLastAppliedPlan: (plan: any) => void;
  setStatusMessage: (message: string) => void;
  clearRedo: () => void;
};

export function createApplyHandlers(
  setters: ApplyStateSetters,
  initRepo: (repoRoot: string) => Promise<void>
) {
  const { setLastAppliedPlan, setStatusMessage, clearRedo } = setters;

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
      setStatusMessage('Applying selected file...');
      const plan = buildApplyPlanFromItems([selectedItem]);
      const result = await window.inscribeAPI.applyChanges(plan, repoRoot);
      
      if (result.success) {
        setLastAppliedPlan(plan);
        setStatusMessage(`✓ Applied: ${selectedItem.file}. Undo restores only the most recent apply batch.`);
        await initRepo(repoRoot); // Refresh state
      } else {
        setStatusMessage(`Failed to apply: ${result.errors?.join(', ') || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to apply selected:', error);
      setStatusMessage(`Failed to apply: ${error}`);
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
      setStatusMessage(`Applying ${reviewItems.length} file(s)...`);
      const plan = buildApplyPlanFromItems(reviewItems);
      const result = await window.inscribeAPI.applyChanges(plan, repoRoot);
      
      if (result.success) {
        setLastAppliedPlan(plan);
        setStatusMessage(`✓ Applied all: ${reviewItems.length} file(s). Undo restores only the most recent apply batch.`);
        await initRepo(repoRoot); // Refresh state
      } else {
        setStatusMessage(`Failed to apply: ${result.errors?.join(', ') || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to apply all:', error);
      setStatusMessage(`Failed to apply all: ${error}`);
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

  const handleRedo = async (repoRoot: string | null, lastAppliedPlan: any) => {
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
    handleUndo,
    handleRedo,
  };
}
