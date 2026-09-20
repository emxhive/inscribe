import type { AppState } from '@/types';

export function applyAppStateUpdates(prev: AppState, updates: Partial<AppState>): AppState {
  const next = { ...prev, ...updates };

  if ('aiInput' in updates && updates.aiInput !== prev.aiInput && !('selectedIntakeLineIndex' in updates)) {
    next.selectedIntakeLineIndex = null;
  }

  if (prev.mode === 'review' && next.mode !== 'review') {
    next.selectedHunkId = null;
    next.reviewView = 'unified';
    next.selectedReviewFileId = null;
    next.collapsedHunkIdsByFile = {};
    next.collapsedDiffGroupIdsByFile = {};
  }

  if (
    'aiInput' in updates &&
    updates.aiInput !== prev.aiInput &&
    (
      prev.previewSession !== null ||
      prev.previewDiagnostics.length > 0 ||
      prev.reviewFiles.length > 0
    )
  ) {
    next.parseErrors = 'parseErrors' in updates ? next.parseErrors : [];
    next.parseWarnings = 'parseWarnings' in updates ? next.parseWarnings : [];
    next.previewDiagnostics = 'previewDiagnostics' in updates ? next.previewDiagnostics : [];
    next.reviewItems = 'reviewItems' in updates ? next.reviewItems : [];
    next.reviewFiles = 'reviewFiles' in updates ? next.reviewFiles : [];
    next.selectedReviewFileId = 'selectedReviewFileId' in updates ? next.selectedReviewFileId : null;
    next.collapsedHunkIdsByFile = {};
    next.collapsedDiffGroupIdsByFile = {};
    next.previewSession = null;
    next.mode = 'mode' in updates ? next.mode : 'intake';
    next.pipelineStatus = 'pipelineStatus' in updates ? next.pipelineStatus : 'idle';
    next.statusMessage = 'statusMessage' in updates
      ? next.statusMessage
      : 'intake changed. Preview the blocks again.';
  }

  if ('reviewItems' in updates && updates.reviewItems !== prev.reviewItems && !('previewSession' in updates)) {
    next.previewSession = null;
  }

  if ('repoRoot' in updates && updates.repoRoot !== prev.repoRoot) {
    next.selectedHunkId = null;
    next.collapsedHunkIdsByFile = {};
    next.collapsedDiffGroupIdsByFile = {};
    next.reviewItems = [];
    next.reviewFiles = [];
    next.selectedReviewFileId = null;
    next.isTerminalOpen = false;
    next.terminalCommandSuggestions = [];
    next.previewSession = null;
    next.previewDiagnostics = [];
  }

  return next;
}
