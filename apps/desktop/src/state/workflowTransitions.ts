import type { AppState } from '@/types';
import { createEmptyHistoryReview } from './historyTransitions';

export function buildReviewExitUpdate(): Partial<AppState> {
  return {
    mode: 'intake',
    selectedHunkId: null,
    reviewView: 'unified',
    selectedReviewFileId: null,
    collapsedHunkIdsByFile: {},
    collapsedDiffGroupIdsByFile: {},
  };
}

export function buildReviewEnterUpdate(
  state: Pick<
    AppState,
    'reviewFiles' | 'selectedReviewFileId'
  >,
): Partial<AppState> {
  const selectedReviewFileId =
    state.selectedReviewFileId &&
    state.reviewFiles.some(
      (file) =>
        file.id === state.selectedReviewFileId,
    )
      ? state.selectedReviewFileId
      : state.reviewFiles[0]?.id ?? null;

  return {
    mode: 'review',
    selectedReviewFileId,
    selectedHunkId: null,
    reviewView: 'unified',
    rightPanelOwner: 'inspector',
    rightPanelView: 'properties',
  };
}

export function buildIntakeChangeInvalidation(
  prev: AppState,
): Partial<AppState> {
  const base: Partial<AppState> = {
    lastAppliedActionId: null,
    selectedIntakeLineIndex: null,
  };

  const hasStalePreviewState =
    prev.previewSession !== null ||
    prev.previewDiagnostics.length > 0 ||
    prev.reviewFiles.length > 0;

  if (!hasStalePreviewState) {
    return base;
  }

  return {
    ...base,
    parseErrors: [],
    previewDiagnostics: [],
    reviewItems: [],
    reviewFiles: [],
    selectedReviewFileId: null,
    collapsedHunkIdsByFile: {},
    collapsedDiffGroupIdsByFile: {},
    previewSession: null,
    mode: 'intake',
    pipelineStatus: 'idle',
    statusMessage:
      'intake changed. Preview the blocks again.',
    ...(prev.mode === 'review'
      ? {
          selectedHunkId: null,
          reviewView: 'unified' as const,
        }
      : {}),
  };
}

export function buildIntakeReplacementUpdate(
  content: string,
  statusMessage: string,
): Partial<AppState> {
  return {
    mode: 'intake',
    aiInput: content,
    parseErrors: [],
    previewDiagnostics: [],
    reviewItems: [],
    reviewFiles: [],
    selectedReviewFileId: null,
    selectedIntakeBlockId: null,
    selectedIntakeLineIndex: null,
    rightPanelOwner: 'inspector',
    rightPanelView: 'properties',
    pipelineStatus: 'idle',
    selectedHunkId: null,
    reviewView: 'unified',
    collapsedHunkIdsByFile: {},
    collapsedDiffGroupIdsByFile: {},
    terminalCommandSuggestions: [],
    previewSession: null,
    lastAppliedActionId: null,
    statusMessage,
  };
}

export function buildRepositoryResetUpdate(
  repoRoot: string | null,
  statusMessage: string,
): Partial<AppState> {
  return {
    repoRoot,
    topLevelFolders: [],
    ignore: {
      entries: [],
      source: 'none',
      path: '',
    },
    suggested: [],
    indexedFiles: [],
    indexedFileSet: new Set(),
    indexStatus: {
      state: 'idle',
    },

    mode: 'intake',
    aiInput: '',
    parseErrors: [],
    previewDiagnostics: [],
    reviewItems: [],
    reviewFiles: [],
    selectedReviewFileId: null,
    selectedIntakeBlockId: null,
    selectedIntakeLineIndex: null,

    rightPanelOwner: 'inspector',
    rightPanelView: 'properties',
    pipelineStatus: 'idle',
    isApplyingInProgress: false,
    isRestoringInProgress: false,
    selectedHunkId: null,
    reviewView: 'unified',
    collapsedHunkIdsByFile: {},
    collapsedDiffGroupIdsByFile: {},
    isTerminalOpen: false,
    terminalCommandSuggestions: [],
    previewSession: null,
    lastAppliedActionId: null,

    historyItems: [],
    historyReview: createEmptyHistoryReview(),

    statusMessage,
  };
}