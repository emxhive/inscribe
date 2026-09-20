import { extractCliCommandSuggestions } from '@inscribe/shared';
import { decorateHistoryEntries } from '@/utils';
import { useAppStateContext } from './useAppStateContext';
import { initRepositoryState } from './useRepositoryActions';
import type { ApplyErrorDTO } from '../ipc/applyTypes';

/** Applies the immutable preview session as one transaction. */
export function useApplyActions() {
  const { state, updateState } = useAppStateContext();

  const refreshRepo = async (repoRoot: string) => {
    await initRepositoryState(repoRoot, updateState);
  };

  const handleApplyAll = async () => {
    if (!state.repoRoot || state.isApplyingInProgress) return;

    const canApply =
      state.reviewFiles.length > 0 &&
      state.reviewItems.length > 0 &&
      state.reviewItems.every((item) => item.status === 'pending') &&
      Boolean(state.previewSession);

    if (!canApply) {
      updateState({
        statusMessage: state.reviewItems.some((item) => item.status === 'applied')
          ? 'This preview has already been applied. Preview again to apply new changes.'
          : 'preview session is unavailable. Preview the changes again.',
      });
      return;
    }

    const repoRoot = state.repoRoot;
    const previewToken = state.previewSession!.previewToken;
    updateState({
      isApplyingInProgress: true,
      pipelineStatus: 'applying',
      statusMessage: `Applying preview (${state.reviewFiles.length} file${state.reviewFiles.length === 1 ? '' : 's'})...`,
    });

    try {
      const result = await window.inscribeAPI.apply({ repoRoot, previewToken });
      if (!result.ok) {
        updateState({
          previewSession: null,
          pipelineStatus: 'apply-failure',
          statusMessage: formatApplyErrors(result.errors),
        });
        return;
      }

      if (result.historyEntries?.length) {
        updateState((prev) => ({
          historyItems: [
            ...decorateHistoryEntries(result.historyEntries ?? []),
            ...prev.historyItems,
          ],
        }));
      }

      const suggestions = extractCliCommandSuggestions(state.aiInput);
      updateState({
        reviewItems: state.reviewItems.map((item) => ({ ...item, status: 'applied' })),
        previewSession: null,
        pipelineStatus: 'apply-success',
        statusMessage: `✓ Applied preview: ${result.appliedFileCount} file(s).`,
        ...(suggestions.length > 0 ? { terminalCommandSuggestions: suggestions } : {}),
      });
      await refreshRepo(repoRoot);
    } catch (error) {
      console.error('Failed to apply preview:', error);
      updateState({
        previewSession: null,
        pipelineStatus: 'apply-failure',
        statusMessage: 'Failed to apply preview.',
      });
    } finally {
      updateState({ isApplyingInProgress: false });
    }
  };

  return { handleApplyAll };
}

function formatApplyErrors(errors: ApplyErrorDTO[]): string {
  return errors
    .map((err) => err.filePath ? `${err.code} in ${err.filePath}: ${err.message}` : `${err.code}: ${err.message}`)
    .join('; ');
}
