import type { AppState } from '@/types';

export function selectIsParsingInProgress(
  state: Pick<AppState, 'pipelineStatus'>,
): boolean {
  return state.pipelineStatus === 'parsing';
}

export function selectIsAppliedReview(
  state: Pick<
    AppState,
    'mode' | 'reviewItems'
  >,
): boolean {
  return (
    state.mode === 'review' &&
    state.reviewItems.length > 0 &&
    state.reviewItems.every(
      (item) => item.status === 'applied',
    )
  );
}

export function selectCanApplyPreview(
  state: Pick<
    AppState,
    | 'repoRoot'
    | 'previewSession'
    | 'reviewFiles'
    | 'reviewItems'
    | 'isApplyingInProgress'
  >,
): boolean {
  return (
    Boolean(state.repoRoot) &&
    Boolean(state.previewSession) &&
    state.reviewFiles.length > 0 &&
    state.reviewItems.length > 0 &&
    state.reviewItems.every(
      (item) => item.status === 'pending',
    ) &&
    !state.isApplyingInProgress
  );
}

export function selectCanRevertLastAppliedAction(
  state: Pick<
    AppState,
    | 'mode'
    | 'repoRoot'
    | 'lastAppliedActionId'
    | 'reviewItems'
    | 'pipelineStatus'
    | 'isApplyingInProgress'
    | 'isRestoringInProgress'
    | 'historyReview'
  >,
): boolean {
  return (
    Boolean(state.repoRoot) &&
    Boolean(state.lastAppliedActionId) &&
    selectIsAppliedReview(state) &&
    !selectIsParsingInProgress(state) &&
    !state.isApplyingInProgress &&
    !state.isRestoringInProgress &&
    !state.historyReview.actionId
  );
}

export function selectHasReviewablePartialPreview(
  state: Pick<
    AppState,
    | 'pipelineStatus'
    | 'previewSession'
    | 'reviewFiles'
  >,
): boolean {
  return (
    state.pipelineStatus === 'parse-partial' &&
    Boolean(state.previewSession) &&
    state.reviewFiles.length > 0
  );
}

export function selectCanReturnToPartialIntake(
  state: Pick<
    AppState,
    | 'mode'
    | 'previewSession'
    | 'previewDiagnostics'
    | 'reviewItems'
  >,
): boolean {
  return (
    state.mode === 'review' &&
    Boolean(state.previewSession) &&
    state.previewDiagnostics.length > 0 &&
    state.reviewItems.length > 0 &&
    state.reviewItems.every(
      (item) => item.status === 'pending',
    )
  );
}

export function selectIsHistoryReviewActive(
  state: Pick<AppState, 'historyReview'>,
): boolean {
  return Boolean(
    state.historyReview.actionId,
  );
}