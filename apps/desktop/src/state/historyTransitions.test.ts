import {
  describe,
  expect,
  it,
} from 'vitest';
import type {
  RestorePreview,
} from '@inscribe/shared';
import type {
  AppState,
  HistoryReviewState,
} from '@/types';
import {
  buildHistoryPreviewFailedUpdate,
  buildHistoryPreviewResolvedUpdate,
  buildHistoryPreviewStartedUpdate,
  buildHistoryRestoreFailedUpdate,
  buildHistoryRestoreRefreshFailedUpdate,
  buildHistoryRestoreStartedUpdate,
  buildHistoryRestoreSuccessUpdate,
  buildHistoryReviewClosedUpdate,
  buildImmediateRevertFailedUpdate,
  buildImmediateRevertIntakeChangedUpdate,
  buildImmediateRevertRefreshFailedUpdate,
  buildImmediateRevertRepositoryChangedUpdate,
  buildImmediateRevertStartedUpdate,
  buildImmediateRevertSuccessUpdate,
  buildRestoreFinishedUpdate,
  createEmptyHistoryReview,
  isCurrentHistoryPreviewRequest,
} from './historyTransitions';

const historyReview: HistoryReviewState = {
  actionId: 'action-1',
  requestId: 'request-1',
  selectedEntryId: 'entry-1',
  preview: null,
  isLoading: false,
  isRestoring: false,
  error: null,
};

describe('history state transitions', () => {
  it('creates an empty history review state', () => {
    expect(
      createEmptyHistoryReview(),
    ).toEqual({
      actionId: null,
      requestId: null,
      selectedEntryId: null,
      preview: null,
      isLoading: false,
      isRestoring: false,
      error: null,
    });
  });

  it('starts a historical restore preview', () => {
    expect(
      buildHistoryPreviewStartedUpdate(
        'action-1',
        'request-1',
      ),
    ).toEqual({
      historyReview: {
        actionId: 'action-1',
        requestId: 'request-1',
        selectedEntryId: null,
        preview: null,
        isLoading: true,
        isRestoring: false,
        error: null,
      },
    });
  });

  it('accepts only the currently active restore preview request', () => {
    const state = {
      repoRoot: '/repo',
      historyReview,
    };

    expect(
      isCurrentHistoryPreviewRequest(
        state,
        {
          repoRoot: '/repo',
          actionId: 'action-1',
          requestId: 'request-1',
        },
      ),
    ).toBe(true);

    expect(
      isCurrentHistoryPreviewRequest(
        state,
        {
          repoRoot: '/repo',
          actionId: 'action-1',
          requestId: 'stale-request',
        },
      ),
    ).toBe(false);
  });

  it('resolves a historical preview and selects its first file', () => {
    const preview = {
      files: [
        {
          entryId: 'entry-2',
        },
      ],
      eligible: true,
    } as RestorePreview;

    expect(
      buildHistoryPreviewResolvedUpdate(
        'action-1',
        'request-1',
        preview,
      ),
    ).toMatchObject({
      historyReview: {
        actionId: 'action-1',
        requestId: 'request-1',
        selectedEntryId: 'entry-2',
        preview,
        isLoading: false,
        isRestoring: false,
        error: null,
      },
    });
  });

  it('records a failed historical preview without losing its request identity', () => {
    expect(
      buildHistoryPreviewFailedUpdate(
        'action-1',
        'request-1',
        'Preview failed.',
      ),
    ).toMatchObject({
      historyReview: {
        actionId: 'action-1',
        requestId: 'request-1',
        selectedEntryId: null,
        preview: null,
        isLoading: false,
        isRestoring: false,
        error: 'Preview failed.',
      },
    });
  });

  it('starts and fails a reviewed historical restore coherently', () => {
    expect(
      buildHistoryRestoreStartedUpdate(
        historyReview,
      ),
    ).toMatchObject({
      isRestoringInProgress: true,
      historyReview: {
        actionId: 'action-1',
        isRestoring: true,
        error: null,
      },
      statusMessage:
        'Restoring action...',
    });

    expect(
      buildHistoryRestoreFailedUpdate(
        {
          ...historyReview,
          isRestoring: true,
        },
        'Restore failed.',
      ),
    ).toMatchObject({
      historyReview: {
        actionId: 'action-1',
        isRestoring: false,
        error: 'Restore failed.',
      },
      statusMessage:
        'Restore failed.',
    });
  });

  it('completes historical restore and invalidates immediate undo', () => {
    const historyItems = [
      {
        id: 'history-1',
      },
    ] as AppState['historyItems'];

    expect(
      buildHistoryRestoreSuccessUpdate(
        historyItems,
      ),
    ).toMatchObject({
      historyItems,
      lastAppliedActionId: null,
      statusMessage:
        'action restored. The restore is recorded in History.',
      historyReview:
        createEmptyHistoryReview(),
    });
  });

  it('distinguishes a successful restore from a failed repository refresh', () => {
    expect(
      buildHistoryRestoreRefreshFailedUpdate(
        'repo init failed',
      ),
    ).toEqual({
      statusMessage:
        'Action restored, but repository refresh failed: repo init failed',
    });
  });

  it('models direct immediate revert without opening history review', () => {
    expect(
      buildImmediateRevertStartedUpdate(),
    ).toEqual({
      isRestoringInProgress: true,
      pipelineStatus: 'idle',
      statusMessage:
        'Reverting changes...',
    });

    const historyItems = [
      {
        id: 'history-2',
      },
    ] as AppState['historyItems'];

    const success =
      buildImmediateRevertSuccessUpdate(
        historyItems,
      );

    expect(success).toMatchObject({
      historyItems,
      lastAppliedActionId: null,
      statusMessage:
        'Changes reverted. Rebuilding preview...',
    });

    expect(success).not.toHaveProperty(
      'historyReview',
    );
  });

  it('reports direct revert and post-revert refresh failures accurately', () => {
    expect(
      buildImmediateRevertFailedUpdate(
        'unsafe restore',
      ),
    ).toEqual({
      statusMessage:
        'Unable to revert changes: unsafe restore',
    });

    expect(
      buildImmediateRevertRefreshFailedUpdate(
        'repo init failed',
      ),
    ).toEqual({
      statusMessage:
        'Changes reverted, but repository refresh failed: repo init failed',
    });
  });

  it('describes why an automatic post-revert preview was skipped', () => {
    expect(
      buildImmediateRevertRepositoryChangedUpdate(),
    ).toEqual({
      statusMessage:
        'Changes reverted. Repository changed before the preview could be rebuilt.',
    });

    expect(
      buildImmediateRevertIntakeChangedUpdate(),
    ).toEqual({
      statusMessage:
        'Changes reverted. Intake changed during the revert; preview again to review it.',
    });
  });

  it('finishes restore activity and closes historical review', () => {
    expect(
      buildRestoreFinishedUpdate(),
    ).toEqual({
      isRestoringInProgress: false,
    });

    expect(
      buildHistoryReviewClosedUpdate(),
    ).toEqual({
      rightPanelOwner: 'history',
      historyReview:
        createEmptyHistoryReview(),
    });
  });
});