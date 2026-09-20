import { describe, expect, it } from 'vitest';
import { initialState } from './useAppState';
import { applyAppStateUpdates } from './appStateUtils';

describe('applyAppStateUpdates', () => {
  it('preserves an atomic successful preview transition', () => {
    const reviewItems = [{ id: 'operation-1' }] as typeof initialState.reviewItems;
    const reviewFiles = [{ id: 'file-1' }] as typeof initialState.reviewFiles;
    const previewSession = { previewToken: 'preview-token', expiresAt: '2026-09-20T19:00:00.000Z' };

    const next = applyAppStateUpdates(initialState, {
      mode: 'review',
      reviewItems,
      reviewFiles: reviewFiles,
      selectedReviewFileId: 'file-1',
      previewSession: previewSession,
    });

    expect(next.mode).toBe('review');
    expect(next.reviewItems).toBe(reviewItems);
    expect(next.reviewFiles).toBe(reviewFiles);
    expect(next.selectedReviewFileId).toBe('file-1');
    expect(next.previewSession).toBe(previewSession);
  });

  it('invalidates stale preview and review state when intake changes', () => {
    const prev = {
      ...initialState,
      mode: 'review' as const,
      aiInput: 'old input',
      reviewItems: [{ id: 'operation-1' }] as typeof initialState.reviewItems,
      reviewFiles: [{ id: 'file-1' }] as typeof initialState.reviewFiles,
      selectedReviewFileId: 'file-1',
      previewSession: { previewToken: 'preview-token', expiresAt: 'later' },
      previewDiagnostics: [{ type: 'protocol' as const, code: 'INVALID_MODE', message: 'invalid' }],
    };

    const next = applyAppStateUpdates(prev, { aiInput: 'new input' });

    expect(next.mode).toBe('intake');
    expect(next.reviewItems).toEqual([]);
    expect(next.reviewFiles).toEqual([]);
    expect(next.selectedReviewFileId).toBeNull();
    expect(next.previewSession).toBeNull();
    expect(next.previewDiagnostics).toEqual([]);
  });

  it('invalidates stale preview and review state when the repository changes', () => {
    const prev = {
      ...initialState,
      repoRoot: '/old-repo',
      reviewItems: [{ id: 'operation-1' }] as typeof initialState.reviewItems,
      reviewFiles: [{ id: 'file-1' }] as typeof initialState.reviewFiles,
      selectedReviewFileId: 'file-1',
      previewSession: { previewToken: 'preview-token', expiresAt: 'later' },
      previewDiagnostics: [{ type: 'protocol' as const, code: 'INVALID_MODE', message: 'invalid' }],
    };

    const next = applyAppStateUpdates(prev, { repoRoot: '/new-repo' });

    expect(next.reviewItems).toEqual([]);
    expect(next.reviewFiles).toEqual([]);
    expect(next.selectedReviewFileId).toBeNull();
    expect(next.previewSession).toBeNull();
    expect(next.previewDiagnostics).toEqual([]);
  });

  it('invalidates the old preview session when review items are replaced without a new session', () => {
    const prev = {
      ...initialState,
      reviewItems: [{ id: 'operation-1' }] as typeof initialState.reviewItems,
      previewSession: { previewToken: 'preview-token', expiresAt: 'later' },
    };

    const next = applyAppStateUpdates(prev, {
      reviewItems: [{ id: 'operation-2' }] as typeof initialState.reviewItems,
    });

    expect(next.previewSession).toBeNull();
  });
});
