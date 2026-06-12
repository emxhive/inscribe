import {
    buildApplyPlanFromItems,
    decorateHistoryEntries,
    getReviewApplySummary,
    getReviewItemApplyState,
    summarizeSkippedReviewItems,
    V2_APPLY_BLOCKER,
} from '@/utils';
import type { ReviewItem } from '@/types';
import { extractCliCommandSuggestions } from '@inscribe/shared';
import { useAppStateContext } from './useAppStateContext';
import { initRepositoryState } from './useRepositoryActions';
import { useHistoryActions } from './useHistoryActions';

/**
 * Hook for apply/undo operations
 */
export function useApplyActions() {
    const { state, updateState, setLastAppliedPlan } = useAppStateContext();
    const { restoreItem, restoreGroup } = useHistoryActions();
   
    const refreshRepo = async (repoRoot: string) => {
        await initRepositoryState(repoRoot, updateState);
    };

    const markItemsApplied = (ids: string[]) => {
        const appliedStatus: ReviewItem['status'] = 'applied';
        const appliedIds = new Set(ids);
        updateState((prev) => {
            const nextReviewItems = prev.reviewItems.map((item) =>
                appliedIds.has(item.id) ? { ...item, status: appliedStatus } : item
            );
            const selectedWasApplied = prev.selectedItemId ? appliedIds.has(prev.selectedItemId) : false;
            const reviewPreflightByItem = Object.fromEntries(
                Object.entries(prev.reviewPreflightByItem).filter(([itemId]) => !appliedIds.has(itemId))
            );
            return {
                reviewItems: nextReviewItems,
                reviewPreflightByItem,
                ...(selectedWasApplied ? { isEditing: false, reviewComparisonError: null } : {}),
            };
        });
    };

    const stageTerminalSuggestions = (applyId: string | null) => {
        const suggestions = extractCliCommandSuggestions(state.aiInput);
        if (suggestions.length === 0) {
            return;
        }
        updateState({
            terminalCommandSuggestions: suggestions,
            terminalSuggestionSourceApplyId: applyId,
        });
    };

    const handleApplySelected = async () => {
        if (!state.repoRoot || !state.selectedItemId) return;

        const selectedItem = state.reviewItems.find(item => item.id === state.selectedItemId);
        if (!selectedItem) return;

        if (selectedItem.engineVersion === 'v2') {
            updateState({
                statusMessage: `Cannot apply: ${V2_APPLY_BLOCKER}`,
            });
            return;
        }

        const selectedItemState = getReviewItemApplyState(selectedItem, state.reviewPreflightByItem);
        if (!selectedItemState.applyable) {
            updateState({
                statusMessage: selectedItemState.blocker
                    ? `Cannot apply selected: ${selectedItemState.blocker}`
                    : 'Selected file is not pending',
            });
            return;
        }

        try {
            updateState({
                isApplyingInProgress: true,
                pipelineStatus: 'applying',
                statusMessage: 'Applying selected file...',
                canUndoApply: false,
                lastApplyId: null,
            });

            const plan = buildApplyPlanFromItems([selectedItem]);
            const result = await window.inscribeAPI.applyChanges(plan, state.repoRoot, state.aiInput);

            if (result.historyEntries?.length) {
                updateState((prev) => ({
                    historyItems: [
                        ...decorateHistoryEntries(result.historyEntries ?? []),
                        ...prev.historyItems,
                    ],
                }));
            }

            if (result.success) {
                setLastAppliedPlan(plan);
                const applyId = result.historyEntries?.[0]?.applyId ?? null;
                markItemsApplied([selectedItem.id]);
                updateState({
                    pipelineStatus: 'apply-success',
                    statusMessage: `✓ Applied: ${selectedItem.file}.`,
                    canUndoApply: Boolean(applyId),
                    lastApplyId: applyId,
                    canRedo: true,
                });
                stageTerminalSuggestions(applyId);
                await refreshRepo(state.repoRoot);
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
    };

    const handleApplyAll = async () => {
        if (!state.repoRoot) return;

        const hasAnyV2 = state.reviewItems.some(item => item.engineVersion === 'v2');
        if (hasAnyV2) {
            updateState({ statusMessage: `Cannot apply: ${V2_APPLY_BLOCKER}` });
            return;
        }

        const hasAnyApplied = state.reviewItems.some(item => item.status === 'applied');
        if (hasAnyApplied) {
            updateState({ statusMessage: 'Some files have already been applied' });
            return;
        }

        const applySummary = getReviewApplySummary(state.reviewItems, state.reviewPreflightByItem);
        if (applySummary.staticBlockedItems.length > 0) {
            updateState({ statusMessage: `Cannot apply: ${applySummary.staticBlockedItems.length} file(s) have validation errors` });
            return;
        }

        if (applySummary.preflightBlockedItems.length > 0) {
            updateState({ statusMessage: `Cannot apply all: ${applySummary.preflightBlockedItems.length} file(s) have comparison/preflight blockers` });
            return;
        }

        if (applySummary.unresolvedPreflightItems.length > 0) {
            updateState({ statusMessage: `Cannot apply all: ${applySummary.unresolvedPreflightItems.length} file(s) are still awaiting comparison/preflight checks` });
            return;
        }

        const pendingItems = applySummary.pendingItems;
        if (pendingItems.length === 0) {
            updateState({ statusMessage: 'No pending files to apply' });
            return;
        }

        try {
            updateState({
                isApplyingInProgress: true,
                pipelineStatus: 'applying',
                statusMessage: `Applying ${pendingItems.length} file(s)...`,
                canUndoApply: false,
                lastApplyId: null,
            });

            const plan = buildApplyPlanFromItems(pendingItems);
            const result = await window.inscribeAPI.applyChanges(plan, state.repoRoot, state.aiInput);

            if (result.historyEntries?.length) {
                updateState((prev) => ({
                    historyItems: [
                        ...decorateHistoryEntries(result.historyEntries ?? []),
                        ...prev.historyItems,
                    ],
                }));
            }

            if (result.success) {
                setLastAppliedPlan(plan);
                const applyId = result.historyEntries?.[0]?.applyId ?? null;
                markItemsApplied(pendingItems.map((item) => item.id));
                updateState({
                    pipelineStatus: 'apply-success',
                    statusMessage: `✓ Applied all: ${pendingItems.length} file(s).`,
                    canUndoApply: Boolean(applyId),
                    lastApplyId: applyId,
                    canRedo: true,
                });
                stageTerminalSuggestions(applyId);
                await refreshRepo(state.repoRoot);
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
    };

    const handleApplyValidBlocks = async () => {
        if (!state.repoRoot) return;

        const hasAnyV2 = state.reviewItems.some(item => item.engineVersion === 'v2');
        if (hasAnyV2) {
            updateState({
                statusMessage: `Cannot apply: ${V2_APPLY_BLOCKER}`,
                pipelineStatus: 'idle'
            });
            return;
        }

        const applySummary = getReviewApplySummary(state.reviewItems, state.reviewPreflightByItem);
        const pendingItems = applySummary.applyablePendingItems;

        if (pendingItems.length === 0) {
            updateState({
                statusMessage: 'No pending applyable files to apply',
                pipelineStatus: 'idle'
            });
            return;
        }

        const skippedItems = state.reviewItems.filter((item) => item.status !== 'applied' && !pendingItems.includes(item));
        const skippedSummary = summarizeSkippedReviewItems(skippedItems, state.reviewPreflightByItem);

        try {
            updateState({
                isApplyingInProgress: true,
                pipelineStatus: 'applying',
                statusMessage: `Applying ${pendingItems.length} valid file(s)...`,
                canUndoApply: false,
                lastApplyId: null,
            });

            const plan = buildApplyPlanFromItems(pendingItems);
            const result = await window.inscribeAPI.applyChanges(plan, state.repoRoot, state.aiInput);

            if (result.historyEntries?.length) {
                updateState((prev) => ({
                    historyItems: [
                        ...decorateHistoryEntries(result.historyEntries ?? []),
                        ...prev.historyItems,
                    ],
                }));
            }

            if (result.success) {
                setLastAppliedPlan(plan);
                const applyId = result.historyEntries?.[0]?.applyId ?? null;
                markItemsApplied(pendingItems.map((item) => item.id));
                const message = skippedItems.length > 0
                    ? `Applied ${pendingItems.length} valid file(s). Skipped ${skippedItems.length}: ${skippedSummary}.`
                    : `Applied all valid files: ${pendingItems.length} file(s).`;

                updateState({
                    pipelineStatus: 'apply-success',
                    statusMessage: message,
                    canUndoApply: Boolean(applyId),
                    lastApplyId: applyId,
                    canRedo: true,
                });
                stageTerminalSuggestions(applyId);
                await refreshRepo(state.repoRoot);
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
    };

    const handleUndoSelected = async () => {
        if (!state.repoRoot || !state.selectedItemId) return;
        if (state.isApplyingInProgress || state.isRestoringInProgress) return;

        const selectedItem = state.reviewItems.find((item) => item.id === state.selectedItemId);
        if (!selectedItem) return;

        // Since V2 review items can't be applied/restored, we check blockIndex/directives for V1:
        if (selectedItem.engineVersion === 'v2') {
            return;
        }

        const matchingHistoryItem = state.historyItems.find(
            (item) =>
                item.file === selectedItem.file &&
                item.blockIndex === selectedItem.blockIndex &&
                !item.restoredAt
        );

        if (!matchingHistoryItem) {
            updateState({ statusMessage: 'No applied changes found for this selection.' });
            return;
        }

        const result = await restoreItem(matchingHistoryItem);
        if (result?.status === 'success') {
            updateState((prev) => ({
                reviewItems: prev.reviewItems.map((item) =>
                    item.id === selectedItem.id ? { ...item, status: 'pending' } : item
                ),
            }));
        }
    };

    const handleUndoAll = async () => {
        if (!state.repoRoot || !state.canUndoApply || !state.lastApplyId) return;
        if (state.isApplyingInProgress || state.isRestoringInProgress) return;

        const historyItems = state.historyItems.filter(
            (item) => item.applyId === state.lastApplyId && !item.restoredAt
        );
        if (historyItems.length === 0) return;

        const restoredKeys = new Set<string>();
        for (const item of historyItems) {
            const result = await restoreItem(item);
            if (result?.status === 'success') {
                restoredKeys.add(`${item.file}::${item.blockIndex ?? 'unknown'}`);
            }
        }

        if (restoredKeys.size > 0) {
            updateState((prev) => ({
                reviewItems: prev.reviewItems.map((item) => {
                    if (item.engineVersion === 'v2') {
                        return item;
                    }
                    const key = `${item.file}::${item.blockIndex ?? 'unknown'}`;
                    if (!restoredKeys.has(key)) {
                        return item;
                    }
                    return { ...item, status: 'pending' };
                }),
            }));
        }

        updateState({
            canUndoApply: false,
            lastApplyId: null,
        });
    };

    return {
        handleApplySelected,
        handleApplyAll,
        handleApplyValidBlocks,
        handleUndoSelected,
        handleUndoAll,
    };
}
