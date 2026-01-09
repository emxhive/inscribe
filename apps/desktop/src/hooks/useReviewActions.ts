import { useCallback, useMemo } from 'react';
import { useAppStateContext } from './useAppStateContext';
import type { ReviewItem } from '../types';

/**
 * Hook for review-related operations and derived data
 */
export function useReviewActions() {
  const { state, updateState, updateReviewItemContent } = useAppStateContext();
  const handleSelectItem = useCallback((id: string) => {
    updateState({ selectedItemId: id, isEditing: false });
  }, [updateState]);

  const handleEditorChange = useCallback((value: string) => {
    if (state.selectedItemId) {
      updateReviewItemContent(state.selectedItemId, value);
      updateState({ statusMessage: 'Modified (not applied)' });
    }
  }, [state.selectedItemId, updateReviewItemContent, updateState]);

  const handleResetAll = useCallback(() => {
    const resetItems = state.reviewItems.map(item => ({
      ...item,
      editedContent: item.originalContent,
    }));
    updateState({ 
      reviewItems: resetItems,
      statusMessage: 'Reset all to original content'
    });
  }, [state.reviewItems, updateState]);

  // Derived data
  const selectedItem = useMemo(
    () => state.reviewItems.find(item => item.id === state.selectedItemId),
    [state.reviewItems, state.selectedItemId]
  );

  const editorValue = selectedItem?.editedContent || '';

  const validItemsCount = useMemo(
    () => state.reviewItems.filter(item => item.status !== 'invalid').length,
    [state.reviewItems]
  );

  return {
    handleSelectItem,
    handleEditorChange,
    handleResetAll,
    selectedItem,
    editorValue,
    validItemsCount,
  };
}
