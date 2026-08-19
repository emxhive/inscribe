import type { AppState } from '@/types';

export function applyAppStateUpdates(prev: AppState, updates: Partial<AppState>): AppState {
  const next = { ...prev, ...updates };

  if ('aiInput' in updates && updates.aiInput !== prev.aiInput && !('selectedIntakeLineIndex' in updates)) {
    next.selectedIntakeLineIndex = null;
  }

  if (prev.mode === 'review' && next.mode !== 'review') {
    const preserveV2Preview =
      prev.v2PreviewSession !== null &&
      prev.reviewItems.some((item) => item.engineVersion === 'v2');
    next.canUndoApply = false;
    next.lastApplyId = null;
    next.selectedHunkId = null;
    next.reviewView = 'unified';
    if (!preserveV2Preview) {
      next.reviewComparisonError = null;
      next.reviewPreflightByItem = {};
      next.reviewComparisonByItem = {};
    }
  }

  if (
    'aiInput' in updates &&
    updates.aiInput !== prev.aiInput &&
    (
      prev.v2PreviewSession !== null ||
      prev.v2PreviewDiagnostics.length > 0 ||
      prev.reviewItems.some((item) => item.engineVersion === 'v2')
    )
  ) {
    next.parseErrors = 'parseErrors' in updates ? next.parseErrors : [];
    next.parseWarnings = 'parseWarnings' in updates ? next.parseWarnings : [];
    next.v2PreviewDiagnostics = 'v2PreviewDiagnostics' in updates ? next.v2PreviewDiagnostics : [];
    next.parsedBlocks = 'parsedBlocks' in updates ? next.parsedBlocks : [];
    next.validationErrors = 'validationErrors' in updates ? next.validationErrors : [];
    next.reviewItems = 'reviewItems' in updates ? next.reviewItems : [];
    next.selectedItemId = 'selectedItemId' in updates ? next.selectedItemId : null;
    next.reviewComparisonError = null;
    next.reviewPreflightByItem = {};
    next.reviewComparisonByItem = {};
    next.collapsedHunkIdsByItem = {};
    next.collapsedDiffGroupIdsByItem = {};
    next.v2PreviewSession = null;
    next.mode = 'mode' in updates ? next.mode : 'intake';
    next.pipelineStatus = 'pipelineStatus' in updates ? next.pipelineStatus : 'idle';
    next.statusMessage = 'statusMessage' in updates
      ? next.statusMessage
      : 'V2 intake changed. Preview the blocks again.';
  }

  if ('reviewItems' in updates && updates.reviewItems !== prev.reviewItems && !('reviewPreflightByItem' in updates)) {
    next.reviewComparisonError = null;
    next.reviewPreflightByItem = {};
    next.reviewComparisonByItem = {};
  }

  if ('reviewItems' in updates && updates.reviewItems !== prev.reviewItems && !('v2PreviewSession' in updates)) {
    next.v2PreviewSession = null;
  }

  if ('repoRoot' in updates && updates.repoRoot !== prev.repoRoot) {
    next.canUndoApply = false;
    next.lastApplyId = null;
    next.selectedHunkId = null;
    next.reviewComparisonError = null;
    next.reviewPreflightByItem = {};
    next.reviewComparisonByItem = {};
    next.collapsedHunkIdsByItem = {};
    next.collapsedDiffGroupIdsByItem = {};
    next.isTerminalOpen = false;
    next.terminalCommandSuggestions = [];
    next.terminalSuggestionSourceApplyId = null;
    next.v2PreviewSession = null;
    next.v2PreviewDiagnostics = [];
  }

  return next;
}
