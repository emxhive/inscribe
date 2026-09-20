import type { AppState } from '@/types';

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
  | 'isParsingInProgress'
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
  if (state.historyReview.actionId) {
    if (state.historyReview.isLoading) {
      return { id: 'history-restore', label: 'Checking restore...', enabled: false };
    }
    return {
      id: 'history-restore',
      label: state.historyReview.preview?.eligible ? 'Restore action' : 'Restore unavailable',
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
      state.pipelineStatus === 'parse-partial' &&
      Boolean(state.previewSession) &&
      state.reviewFiles.length > 0;

    if (hasPartialPreview) {
      const excludedCount = new Set(
        state.previewDiagnostics.map((diagnostic) => diagnostic.blockIndex ?? `global:${diagnostic.code}:${diagnostic.line ?? ''}`),
      ).size;
      return {
        id: 'review-partial',
        label: `Review ${state.reviewFiles.length} Files · ${excludedCount} Excluded`,
        enabled: !state.isParsingInProgress && !state.isApplyingInProgress,
      };
    }

    return {
      id: 'parse',
      label: state.isParsingInProgress ? 'Parsing...' : 'Preview Changes',
      enabled: Boolean(state.repoRoot) && !state.isParsingInProgress,
    };
  }

  const canApply =
    Boolean(state.repoRoot) &&
    Boolean(state.previewSession) &&
    state.reviewFiles.length > 0 &&
    state.reviewItems.length > 0 &&
    state.reviewItems.every((item) => item.status === 'pending');

  return {
    id: 'apply-all',
    label: 'Apply Preview',
    enabled: canApply && !state.isApplyingInProgress,
  };
}
