import type { RestorePreview } from '@inscribe/shared';
import type {
  AppState,
  HistoryReviewState,
} from '@/types';

export type HistoryPreviewRequest = {
  repoRoot: string;
  actionId: string;
  requestId: string;
};

export function createEmptyHistoryReview(): HistoryReviewState {
  return {
    actionId: null,
    requestId: null,
    selectedEntryId: null,
    preview: null,
    isLoading: false,
    isRestoring: false,
    error: null,
  };
}

export function isCurrentHistoryPreviewRequest(
  state: Pick<AppState, 'repoRoot' | 'historyReview'>,
  request: HistoryPreviewRequest,
): boolean {
  return (
    state.repoRoot === request.repoRoot &&
    state.historyReview.actionId === request.actionId &&
    state.historyReview.requestId === request.requestId
  );
}

export function buildHistoryPreviewStartedUpdate(
  actionId: string,
  requestId: string,
): Partial<AppState> {
  return {
    historyReview: {
      actionId,
      requestId,
      selectedEntryId: null,
      preview: null,
      isLoading: true,
      isRestoring: false,
      error: null,
    },
  };
}

export function buildHistoryPreviewResolvedUpdate(
  actionId: string,
  requestId: string,
  preview: RestorePreview,
): Partial<AppState> {
  return {
    historyReview: {
      actionId,
      requestId,
      selectedEntryId:
        preview.files[0]?.entryId ?? null,
      preview,
      isLoading: false,
      isRestoring: false,
      error: preview.error ?? null,
    },
  };
}

export function buildHistoryPreviewFailedUpdate(
  actionId: string,
  requestId: string,
  message: string,
): Partial<AppState> {
  return {
    historyReview: {
      actionId,
      requestId,
      selectedEntryId: null,
      preview: null,
      isLoading: false,
      isRestoring: false,
      error: message,
    },
  };
}

export function buildHistoryRestoreStartedUpdate(
  historyReview: HistoryReviewState,
): Partial<AppState> {
  return {
    isRestoringInProgress: true,
    historyReview: {
      ...historyReview,
      isRestoring: true,
      error: null,
    },
    statusMessage: 'Restoring action...',
  };
}

export function buildHistoryRestoreFailedUpdate(
  historyReview: HistoryReviewState,
  message: string,
): Partial<AppState> {
  return {
    historyReview: {
      ...historyReview,
      isRestoring: false,
      error: message,
    },
    statusMessage: message,
  };
}

export function buildHistoryRestoreSuccessUpdate(
  historyItems: AppState['historyItems'],
): Partial<AppState> {
  return {
    historyItems,
    historyReview: createEmptyHistoryReview(),
    lastAppliedActionId: null,
    statusMessage:
      'action restored. The restore is recorded in History.',
  };
}

export function buildHistoryRestoreRefreshFailedUpdate(
  message: string,
): Partial<AppState> {
  return {
    statusMessage:
      `Action restored, but repository refresh failed: ${message}`,
  };
}

export function buildImmediateRevertStartedUpdate(): Partial<AppState> {
  return {
    isRestoringInProgress: true,
    pipelineStatus: 'idle',
    statusMessage: 'Reverting changes...',
  };
}

export function buildImmediateRevertFailedUpdate(
  message: string,
): Partial<AppState> {
  return {
    statusMessage:
      `Unable to revert changes: ${message}`,
  };
}

export function buildImmediateRevertSuccessUpdate(
  historyItems: AppState['historyItems'],
): Partial<AppState> {
  return {
    historyItems,
    lastAppliedActionId: null,
    statusMessage:
      'Changes reverted. Rebuilding preview...',
  };
}

export function buildImmediateRevertRefreshFailedUpdate(
  message: string,
): Partial<AppState> {
  return {
    statusMessage:
      `Changes reverted, but repository refresh failed: ${message}`,
  };
}

export function buildImmediateRevertRepositoryChangedUpdate(): Partial<AppState> {
  return {
    statusMessage:
      'Changes reverted. Repository changed before the preview could be rebuilt.',
  };
}

export function buildImmediateRevertIntakeChangedUpdate(): Partial<AppState> {
  return {
    statusMessage:
      'Changes reverted. Intake changed during the revert; preview again to review it.',
  };
}

export function buildRestoreFinishedUpdate(): Partial<AppState> {
  return {
    isRestoringInProgress: false,
  };
}

export function buildHistoryReviewClosedUpdate(): Partial<AppState> {
  return {
    rightPanelOwner: 'history',
    historyReview: createEmptyHistoryReview(),
  };
}