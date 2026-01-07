/**
 * Review-related handlers
 */
import type { ReviewItem } from '../useAppState';

type ReviewStateSetters = {
  setSelectedItemId: (id: string | null) => void;
  setIsEditing: (editing: boolean) => void;
  updateReviewItemContent: (id: string, content: string) => void;
  setReviewItems: (items: ReviewItem[]) => void;
  setStatusMessage: (message: string) => void;
};

export function createReviewHandlers(setters: ReviewStateSetters) {
  const {
    setSelectedItemId,
    setIsEditing,
    updateReviewItemContent,
    setReviewItems,
    setStatusMessage,
  } = setters;

  const handleSelectItem = (id: string) => {
    setSelectedItemId(id);
    setIsEditing(false);
  };

  const handleEditorChange = (selectedItemId: string | null, value: string) => {
    if (selectedItemId) {
      updateReviewItemContent(selectedItemId, value);
      setStatusMessage('Modified (not applied)');
    }
  };

  const handleResetAll = (reviewItems: ReviewItem[]) => {
    const resetItems = reviewItems.map(item => ({
      ...item,
      editedContent: item.originalContent,
    }));
    setReviewItems(resetItems);
    setStatusMessage('Reset all to original content');
  };

  return {
    handleSelectItem,
    handleEditorChange,
    handleResetAll,
  };
}
