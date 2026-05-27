import { describe, expect, it } from 'vitest';
import { applyAppStateUpdates } from './appStateUtils';
import { initialState } from './useAppState';

const buildReviewState = () =>
  applyAppStateUpdates(initialState, {
    mode: 'review',
    canUndoApply: true,
    lastApplyId: 'apply-1',
  });

describe('applyAppStateUpdates', () => {
  it('starts with Undo Apply disabled by default', () => {
    expect(initialState.canUndoApply).toBe(false);
    expect(initialState.lastApplyId).toBe(null);
  });

  it('keeps Undo Apply enabled immediately after a successful apply update', () => {
    const updated = applyAppStateUpdates(initialState, {
      canUndoApply: true,
      lastApplyId: 'apply-1',
    });

    expect(updated.canUndoApply).toBe(true);
    expect(updated.lastApplyId).toBe('apply-1');
  });

  it('disables Undo Apply when leaving the review context', () => {
    const reviewState = buildReviewState();
    const next = applyAppStateUpdates(reviewState, { mode: 'intake' });

    expect(next.canUndoApply).toBe(false);
    expect(next.lastApplyId).toBe(null);
  });

  it('clears stale review comparison/preflight state when leaving review', () => {
    const reviewState = applyAppStateUpdates(initialState, {
      mode: 'review',
      reviewComparisonError: 'Selected comparison failed',
      reviewPreflightByItem: {
        item: { status: 'failed', fingerprint: 'old', error: 'Old blocker' },
      },
    });
    const next = applyAppStateUpdates(reviewState, { mode: 'intake' });

    expect(next.reviewComparisonError).toBe(null);
    expect(next.reviewPreflightByItem).toEqual({});
  });

  it('clears stale review comparison/preflight state when review items are rebuilt', () => {
    const reviewState = applyAppStateUpdates(initialState, {
      mode: 'review',
      reviewComparisonError: 'Selected comparison failed',
      reviewPreflightByItem: {
        item: { status: 'failed', fingerprint: 'old', error: 'Old blocker' },
      },
    });
    const next = applyAppStateUpdates(reviewState, { reviewItems: [] });

    expect(next.reviewComparisonError).toBe(null);
    expect(next.reviewPreflightByItem).toEqual({});
  });

  it('clears stale review comparison/preflight state when switching repositories', () => {
    const reviewState = applyAppStateUpdates(initialState, {
      repoRoot: 'C:/repo-a',
      mode: 'review',
      reviewComparisonError: 'Selected comparison failed',
      reviewPreflightByItem: {
        item: { status: 'failed', fingerprint: 'old', error: 'Old blocker' },
      },
    });
    const next = applyAppStateUpdates(reviewState, { repoRoot: 'C:/repo-b' });

    expect(next.reviewComparisonError).toBe(null);
    expect(next.reviewPreflightByItem).toEqual({});
  });
});
