import {
  describe,
  expect,
  it,
} from 'vitest';
import { initialState } from '@/hooks/useAppState';
import {
  selectCanApplyPreview,
  selectCanReturnToPartialIntake,
  selectCanRevertLastAppliedAction,
  selectHasReviewablePartialPreview,
  selectIsAppliedReview,
  selectIsHistoryReviewActive,
  selectIsParsingInProgress,
} from './workflowSelectors';

describe('workflow selectors', () => {
  it('derives parsing activity from pipeline status', () => {
    expect(
      selectIsParsingInProgress({
        pipelineStatus: 'parsing',
      }),
    ).toBe(true);

    expect(
      selectIsParsingInProgress({
        pipelineStatus: 'parse-success',
      }),
    ).toBe(false);
  });

  it('recognizes an applied review', () => {
    expect(
      selectIsAppliedReview({
        mode: 'review',
        reviewItems: [
          {
            id: 'operation-1',
            status: 'applied',
          },
        ] as typeof initialState.reviewItems,
      }),
    ).toBe(true);

    expect(
      selectIsAppliedReview({
        mode: 'review',
        reviewItems: [],
      }),
    ).toBe(false);
  });

  it('allows apply only for a live pending preview', () => {
    const state = {
      ...initialState,
      repoRoot: '/repo',
      mode: 'review' as const,
      previewSession: {
        previewToken: 'preview-token',
        expiresAt: 'later',
      },
      reviewFiles: [
        {
          id: 'file-1',
        },
      ] as typeof initialState.reviewFiles,
      reviewItems: [
        {
          id: 'operation-1',
          status: 'pending',
        },
      ] as typeof initialState.reviewItems,
    };

    expect(
      selectCanApplyPreview(state),
    ).toBe(true);

    expect(
      selectCanApplyPreview({
        ...state,
        isApplyingInProgress: true,
      }),
    ).toBe(false);

    expect(
      selectCanApplyPreview({
        ...state,
        previewSession: null,
      }),
    ).toBe(false);
  });

  it('allows immediate revert only for the most recently applied review', () => {
    const state = {
      ...initialState,
      repoRoot: '/repo',
      mode: 'review' as const,
      lastAppliedActionId: 'action-1',
      reviewItems: [
        {
          id: 'operation-1',
          status: 'applied',
        },
      ] as typeof initialState.reviewItems,
    };

    expect(
      selectCanRevertLastAppliedAction(
        state,
      ),
    ).toBe(true);

    expect(
      selectCanRevertLastAppliedAction({
        ...state,
        historyReview: {
          ...state.historyReview,
          actionId: 'history-action',
        },
      }),
    ).toBe(false);

    expect(
      selectCanRevertLastAppliedAction({
        ...state,
        isRestoringInProgress: true,
      }),
    ).toBe(false);
  });

  it('recognizes reviewable partial previews', () => {
    expect(
      selectHasReviewablePartialPreview({
        pipelineStatus: 'parse-partial',
        previewSession: {
          previewToken: 'preview-token',
          expiresAt: 'later',
        },
        reviewFiles: [
          {
            id: 'file-1',
          },
        ] as typeof initialState.reviewFiles,
      }),
    ).toBe(true);
  });

  it('recognizes when a partial review can return to intake', () => {
    expect(
      selectCanReturnToPartialIntake({
        mode: 'review',
        previewSession: {
          previewToken: 'preview-token',
          expiresAt: 'later',
        },
        previewDiagnostics: [
          {
            type: 'protocol',
            code: 'INVALID_MODE',
            message: 'invalid',
          },
        ],
        reviewItems: [
          {
            id: 'operation-1',
            status: 'pending',
          },
        ] as typeof initialState.reviewItems,
      }),
    ).toBe(true);
  });

  it('recognizes active historical review', () => {
    expect(
      selectIsHistoryReviewActive({
        historyReview: {
          ...initialState.historyReview,
          actionId: 'action-1',
        },
      }),
    ).toBe(true);

    expect(
      selectIsHistoryReviewActive({
        historyReview:
          initialState.historyReview,
      }),
    ).toBe(false);
  });
});