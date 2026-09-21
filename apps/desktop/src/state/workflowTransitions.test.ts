import {
  describe,
  expect,
  it,
} from 'vitest';
import { initialState } from '@/hooks/useAppState';
import {
  buildIntakeChangeInvalidation,
  buildIntakeReplacementUpdate,
  buildRepositoryResetUpdate,
  buildReviewEnterUpdate,
  buildReviewExitUpdate,
} from './workflowTransitions';

describe('workflow state transitions', () => {
  it('invalidates stale preview state when intake changes', () => {
    const prev = {
      ...initialState,
      mode: 'review' as const,
      lastAppliedActionId: 'action-1',
      selectedIntakeLineIndex: 12,
      reviewItems: [
        { id: 'operation-1' },
      ] as typeof initialState.reviewItems,
      reviewFiles: [
        { id: 'file-1' },
      ] as typeof initialState.reviewFiles,
      selectedReviewFileId: 'file-1',
      selectedHunkId: 'hunk-1',
      reviewView: 'result' as const,
      previewDiagnostics: [
        {
          type: 'protocol' as const,
          code: 'INVALID_MODE',
          message: 'invalid',
        },
      ],
      previewSession: {
        previewToken: 'preview-token',
        expiresAt: 'later',
      },
    };

    expect(
      buildIntakeChangeInvalidation(
        prev,
      ),
    ).toMatchObject({
      mode: 'intake',
      lastAppliedActionId: null,
      selectedIntakeLineIndex: null,
      reviewItems: [],
      reviewFiles: [],
      selectedReviewFileId: null,
      selectedHunkId: null,
      reviewView: 'unified',
      previewDiagnostics: [],
      previewSession: null,
      pipelineStatus: 'idle',
    });
  });

  it('does not erase unrelated workflow state for an intake edit with no stale preview', () => {
    const prev = {
      ...initialState,
      lastAppliedActionId: 'action-1',
      selectedIntakeLineIndex: 5,
      statusMessage: 'Existing status',
    };

    expect(
      buildIntakeChangeInvalidation(
        prev,
      ),
    ).toEqual({
      lastAppliedActionId: null,
      selectedIntakeLineIndex: null,
    });
  });

  it('leaves review while resetting review-only navigation', () => {
    expect(
      buildReviewExitUpdate(),
    ).toEqual({
      mode: 'intake',
      selectedHunkId: null,
      reviewView: 'unified',
      selectedReviewFileId: null,
      collapsedHunkIdsByFile: {},
      collapsedDiffGroupIdsByFile: {},
    });
  });

  it('enters review with a valid selected file', () => {
    const reviewFiles = [
      {
        id: 'file-1',
      },
      {
        id: 'file-2',
      },
    ] as typeof initialState.reviewFiles;

    expect(
      buildReviewEnterUpdate({
        reviewFiles,
        selectedReviewFileId: null,
      }),
    ).toMatchObject({
      mode: 'review',
      selectedReviewFileId: 'file-1',
      selectedHunkId: null,
      reviewView: 'unified',
      rightPanelOwner: 'inspector',
      rightPanelView: 'properties',
    });

    expect(
      buildReviewEnterUpdate({
        reviewFiles,
        selectedReviewFileId: 'file-2',
      }).selectedReviewFileId,
    ).toBe('file-2');
  });

  it('fully replaces intake content and invalidates its old preview', () => {
    expect(
      buildIntakeReplacementUpdate(
        'replacement',
        'Loaded intake.',
      ),
    ).toMatchObject({
      mode: 'intake',
      aiInput: 'replacement',
      reviewItems: [],
      reviewFiles: [],
      selectedReviewFileId: null,
      selectedHunkId: null,
      reviewView: 'unified',
      previewSession: null,
      lastAppliedActionId: null,
      terminalCommandSuggestions: [],
      statusMessage: 'Loaded intake.',
    });
  });

  it('resets all repository-bound workflow state when the repository changes', () => {
    const update =
      buildRepositoryResetUpdate(
        '/new-repo',
        'Initializing repository...',
      );

    expect(update).toMatchObject({
      repoRoot: '/new-repo',
      mode: 'intake',
      aiInput: '',
      reviewItems: [],
      reviewFiles: [],
      selectedReviewFileId: null,
      selectedHunkId: null,
      reviewView: 'unified',
      previewSession: null,
      lastAppliedActionId: null,
      historyItems: [],
      isTerminalOpen: false,
      terminalCommandSuggestions: [],
      statusMessage:
        'Initializing repository...',
    });

    expect(update.indexedFileSet).toEqual(
      new Set(),
    );
  });
});