import { useAppStateContext } from './useAppStateContext';

/** Actions for selecting immutable preview files. */
export function useReviewActions() {
  const { state, updateState } = useAppStateContext();

  const handleSelectReviewFile = (fileId: string) => {
    updateState({
      selectedReviewFileId: fileId,
      selectedHunkId: null,
      rightPanelOwner: 'inspector',
    });
  };

  return {
    handleSelectReviewFile,
    pendingItemsCount: state.reviewItems.filter((item) => item.status === 'pending').length,
  };
}
