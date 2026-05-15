import type { AppState } from '@/types';

export function applyAppStateUpdates(prev: AppState, updates: Partial<AppState>): AppState {
  const next = { ...prev, ...updates };

  if (prev.mode === 'review' && next.mode !== 'review') {
    next.canUndoApply = false;
    next.lastApplyId = null;
    next.selectedHunkId = null;
    next.reviewView = 'unified';
  }

  if ('repoRoot' in updates && updates.repoRoot !== prev.repoRoot) {
    next.canUndoApply = false;
    next.lastApplyId = null;
    next.selectedHunkId = null;
    next.reviewComparisonError = null;
    next.collapsedHunkIdsByItem = {};
    next.collapsedDiffGroupIdsByItem = {};
    next.isTerminalOpen = false;
    next.terminalCommandSuggestions = [];
    next.terminalSuggestionSourceApplyId = null;
  }

  return next;
}
