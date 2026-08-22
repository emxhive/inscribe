import { useAppStateContext } from './useAppStateContext';
import { updateDirectivesAndRebuild } from '@/utils/reviewDirectives';
import type { V1ReviewItem } from '@/types';

type DirectiveUpdates = Partial<Record<string, string>>;

/**
 * Hook for review-related operations and derived data
 */
export function useReviewActions() {
  const { state, updateState, updateReviewItemContent } = useAppStateContext();
  const handleSelectItem = (id: string) => {
    const item = state.reviewItems.find((candidate) => candidate.id === id);
    if (!item || item.engineVersion === 'v2') {
      return;
    }
    updateState({
      selectedItemId: id,
      selectedV2FileId: null,
      isEditing: false,
      selectedHunkId: null,
      rightPanelOwner: 'inspector',
    });
  };

  const handleSelectV2File = (fileId: string) => {
    updateState({
      selectedV2FileId: fileId,
      selectedItemId: null,
      isEditing: false,
      selectedHunkId: null,
      rightPanelOwner: 'inspector',
    });
  };

  const handleEditorChange = (value: string) => {
    if (state.selectedItemId) {
      updateReviewItemContent(state.selectedItemId, value);
      updateState({ statusMessage: 'Modified (not applied)' });
    }
  };

  const handleUpdateDirectives = async (itemId: string, updates: DirectiveUpdates) => {
    try {
      const result = await updateDirectivesAndRebuild({
        aiInput: state.aiInput,
        reviewItems: state.reviewItems.filter(
          (item): item is V1ReviewItem => item.engineVersion !== 'v2',
        ),
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
  const selectedItem = state.reviewItems.find(
    (item): item is V1ReviewItem => item.id === state.selectedItemId && item.engineVersion !== 'v2',
  );

  const editorValue = selectedItem?.editedContent || '';

  const pendingItemsCount = state.reviewItems.filter(item => item.status === 'pending').length;

  return {
    handleSelectItem,
    handleSelectV2File,
    handleEditorChange,
    handleUpdateDirectives,
    selectedItem,
    editorValue,
    pendingItemsCount,
  };
}
