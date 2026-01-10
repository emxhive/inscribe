import { useAppStateContext } from './useAppStateContext';
import type { ReviewItem } from '@/types';

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

  // Derived data
  const selectedItem = state.reviewItems.find(item => item.id === state.selectedItemId);

  const editorValue = selectedItem?.editedContent || '';

  const pendingItemsCount = state.reviewItems.filter(item => item.status === 'pending').length;

  return {
    handleSelectItem,
    handleEditorChange,
    handleResetAll,
    selectedItem,
    editorValue,
    pendingItemsCount,
  };
}
