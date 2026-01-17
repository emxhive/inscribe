import { useAppStateContext } from './useAppStateContext';
import type { ReviewItem } from '@/types';
import { updateDirectivesAndRebuild } from '@/utils/reviewDirectives';

type DirectiveUpdates = Partial<Record<string, string>>;

/**
 * Hook for review-related operations and derived data
 */
export function useReviewActions() {
  const { state, updateState, updateReviewItemContent } = useAppStateContext();
  const handleSelectItem = (id: string) => {
    updateState({ selectedItemId: id, isEditing: false });
  };

  const handleEditorChange = (value: string) => {
    if (state.selectedItemId) {
      updateReviewItemContent(state.selectedItemId, value);
      updateState({ statusMessage: 'Modified (not applied)' });
    }
  };

  const handleResetAll = () => {
    const resetItems: ReviewItem[] = state.reviewItems.map((item) => {
      const status: ReviewItem['status'] =
        item.status === 'invalid' ? 'invalid' : 'pending';
      return {
        ...item,
        editedContent: item.originalContent,
        status,
      };
    });
    updateState({ 
      reviewItems: resetItems,
      statusMessage: 'Reset all to original content'
    });
  };

  const handleUpdateDirectives = async (itemId: string, updates: DirectiveUpdates) => {
    try {
      const result = await updateDirectivesAndRebuild({
        aiInput: state.aiInput,
        reviewItems: state.reviewItems,
        repoRoot: state.repoRoot,
        targetItemId: itemId,
        updates,
      });

      if ('error' in result) {
        updateState({
          parseErrors: result.parseErrors ?? state.parseErrors,
          statusMessage: result.error,
        });
        return;
      }

      updateState((prev) => {
        const nextSelectedId =
          prev.selectedItemId && result.reviewItems.some((item) => item.id === prev.selectedItemId)
            ? prev.selectedItemId
            : result.reviewItems.length > 0
              ? result.reviewItems[0].id
              : null;

        return {
          aiInput: result.nextInput,
          parsedBlocks: result.parsedBlocks,
          parseErrors: [],
          validationErrors: result.validationErrors,
          reviewItems: result.reviewItems,
          selectedItemId: nextSelectedId,
          statusMessage: 'Directives updated.',
        };
      });
    } catch (error) {
      console.error('Failed to update directives:', error);
      updateState({
        statusMessage: 'Failed to update directives.',
        parseErrors: [String(error)],
      });
    }
  };

  // Derived data
  const selectedItem = state.reviewItems.find(item => item.id === state.selectedItemId);

  const editorValue = selectedItem?.editedContent || '';

  const pendingItemsCount = state.reviewItems.filter(item => item.status === 'pending').length;

  return {
    handleSelectItem,
    handleEditorChange,
    handleResetAll,
    handleUpdateDirectives,
    selectedItem,
    editorValue,
    pendingItemsCount,
  };
}
