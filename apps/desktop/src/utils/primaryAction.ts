import type { AppState } from '@/types';
import {
  selectCanApplyPreview,
  selectHasReviewablePartialPreview,
  selectIsHistoryReviewActive,
  selectIsParsingInProgress,
} from '@/state/workflowSelectors';

export type PrimaryActionId = 'parse' | 'review-partial' | 'apply-all' | 'history-restore' | 'none';

export interface PrimaryAction {
  id: PrimaryActionId;
  label: string;
  enabled: boolean;
}

type PrimaryActionState = Pick<
  AppState,
  | 'mode'
  | 'repoRoot'
  | 'isApplyingInProgress'
  | 'isRestoringInProgress'
  | 'reviewFiles'
  | 'reviewItems'
  | 'previewSession'
  | 'previewDiagnostics'
  | 'pipelineStatus'
  | 'historyReview'
>;

export function resolvePrimaryAction(state: PrimaryActionState): PrimaryAction {
  const isParsingInProgress =
    selectIsParsingInProgress(state);

  if (selectIsHistoryReviewActive(state)) {
    if (state.historyReview.isLoading) {
      return { id: 'history-restore', label: 'Checking restore...', enabled: false };
    }
    return {
      id: 'history-restore',
      label: state.historyReview.preview?.eligible
        ? 'Restore action'
        : 'Restore unavailable',
      enabled: Boolean(state.historyReview.preview?.eligible)
        && !state.historyReview.isRestoring
        && !state.isApplyingInProgress
        && !state.isRestoringInProgress,
    };
  }

  if (state.isRestoringInProgress) {
    return { id: 'none', label: 'Restoring...', enabled: false };
  }

  if (state.mode === 'intake') {
    const hasPartialPreview =
      selectHasReviewablePartialPreview(
        state,
      );

    if (hasPartialPreview) {
      const excludedCount = new Set(
        state.previewDiagnostics.map((diagnostic) => diagnostic.blockIndex ?? `global:${diagnostic.code}:${diagnostic.line ?? ''}`),
      ).size;
      return {
        id: 'review-partial',
        label: `Review ${state.reviewFiles.length} Files · ${excludedCount} Excluded`,
        enabled: !isParsingInProgress && !state.isApplyingInProgress,
      };
    }

    return {
      id: 'parse',
      label: isParsingInProgress ? 'Parsing...' : 'Preview Changes',
      enabled: Boolean(state.repoRoot) && !isParsingInProgress,
    };
  }

  return {
    id: 'apply-all',
    label: 'Apply Preview',
    enabled:
      selectCanApplyPreview(state),
  };
}
