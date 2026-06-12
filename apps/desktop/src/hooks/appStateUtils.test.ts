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

  it('atomically resets V1 review state and enters review mode on V2 success transition', () => {
    const staleState = applyAppStateUpdates(initialState, {
      parsedBlocks: [{ file: 'src/main.ts', mode: 'replace_file', directives: {}, content: '', blockIndex: 0 }],
      validationErrors: [{ blockIndex: 0, file: 'src/main.ts', message: 'error' }],
      parseErrors: ['some parse error'],
      parseWarnings: [{ message: 'some warning' }],
      reviewComparisonError: 'comparison error',
      selectedHunkId: 'hunk-1',
      collapsedHunkIdsByItem: { '0-src/main.ts': ['hunk-1'] },
      collapsedDiffGroupIdsByItem: { '0-src/main.ts': ['group-1'] },
      isEditing: true,
      reviewView: 'edit',
      mode: 'intake',
    });

    const successUpdate = {
      parsedBlocks: [],
      validationErrors: [],
      reviewItems: [
        {
          engineVersion: 'v2' as const,
          comparisonSource: 'canonical-v2' as const,
          id: '0-src/new.ts',
          file: 'src/new.ts',
          strategy: 'replace_text' as const,
          executionId: 'exec-1',
          operationIndex: 0,
          filePath: 'src/new.ts',
          beforeFileHash: 'hash-before',
          afterFileHash: 'hash-after',
          targetScope: { filePath: 'src/new.ts', strategy: 'replace_text' as const },
          beforeExists: false,
          afterExists: true,
          language: 'typescript',
          lineCount: 0,
          status: 'pending' as const,
          originalContent: '',
          editedContent: '',
        },
      ],
      reviewComparisonByItem: {},
      reviewPreflightByItem: {},
      parseErrors: [],
      parseWarnings: [],
      selectedItemId: '0-src/new.ts',
      selectedHunkId: null,
      collapsedHunkIdsByItem: {},
      collapsedDiffGroupIdsByItem: {},
      isEditing: false,
      reviewView: 'unified' as const,
      reviewComparisonError: null,
      mode: 'review' as const,
      pipelineStatus: 'parse-success' as const,
      isParsingInProgress: false,
      statusMessage: 'Ready to review: 1 V2 operations',
    };

    const nextState = applyAppStateUpdates(staleState, successUpdate);

    expect(nextState.mode).toBe('review');
    expect(nextState.parsedBlocks).toEqual([]);
    expect(nextState.validationErrors).toEqual([]);
    expect(nextState.parseErrors).toEqual([]);
    expect(nextState.parseWarnings).toEqual([]);
    expect(nextState.reviewComparisonError).toBe(null);
    expect(nextState.selectedHunkId).toBe(null);
    expect(nextState.collapsedHunkIdsByItem).toEqual({});
    expect(nextState.collapsedDiffGroupIdsByItem).toEqual({});
    expect(nextState.isEditing).toBe(false);
    expect(nextState.reviewView).toBe('unified');
    expect(nextState.reviewItems).toHaveLength(1);
    expect(nextState.reviewItems[0].id).toBe('0-src/new.ts');
  });

  it('atomically clears V1/V2 review state and returns to intake mode on V2 failure transition', () => {
    const staleState = applyAppStateUpdates(initialState, {
      mode: 'review',
      parsedBlocks: [{ file: 'src/main.ts', mode: 'replace_file', directives: {}, content: '', blockIndex: 0 }],
      validationErrors: [{ blockIndex: 0, file: 'src/main.ts', message: 'error' }],
      reviewItems: [
        {
          engineVersion: 'v2' as const,
          comparisonSource: 'canonical-v2' as const,
          id: '0-src/new.ts',
          file: 'src/new.ts',
          strategy: 'replace_text' as const,
          executionId: 'exec-1',
          operationIndex: 0,
          filePath: 'src/new.ts',
          beforeFileHash: 'hash-before',
          afterFileHash: 'hash-after',
          targetScope: { filePath: 'src/new.ts', strategy: 'replace_text' as const },
          beforeExists: false,
          afterExists: true,
          language: 'typescript',
          lineCount: 0,
          status: 'pending' as const,
          originalContent: '',
          editedContent: '',
        },
      ],
      reviewComparisonByItem: {
        '0-src/new.ts': {
          fingerprint: 'f1',
          comparison: {
            type: 'replace_text',
            file: 'src/new.ts',
            oldContent: '',
            newContent: '',
            regions: [],
            diffHunks: [],
          },
        },
      },
      reviewPreflightByItem: {
        '0-src/new.ts': { status: 'passed', fingerprint: 'f1' },
      },
      selectedItemId: '0-src/new.ts',
      selectedHunkId: 'hunk-1',
      collapsedHunkIdsByItem: { '0-src/new.ts': ['hunk-1'] },
      collapsedDiffGroupIdsByItem: { '0-src/new.ts': ['group-1'] },
      parseWarnings: [{ message: 'some warning' }],
      reviewComparisonError: 'some comparison error',
      isEditing: true,
      reviewView: 'edit',
    });

    const failureUpdate = {
      parsedBlocks: [],
      validationErrors: [],
      reviewItems: [],
      reviewComparisonByItem: {},
      reviewPreflightByItem: {},
      selectedItemId: null,
      selectedHunkId: null,
      collapsedHunkIdsByItem: {},
      collapsedDiffGroupIdsByItem: {},
      parseErrors: ['V2 preview error'],
      parseWarnings: [],
      reviewComparisonError: null,
      isEditing: false,
      reviewView: 'unified' as const,
      mode: 'intake' as const,
      pipelineStatus: 'parse-failure' as const,
      isParsingInProgress: false,
      statusMessage: 'Failed V2 preview',
    };

    const nextState = applyAppStateUpdates(staleState, failureUpdate);

    expect(nextState.mode).toBe('intake');
    expect(nextState.reviewItems).toEqual([]);
    expect(nextState.reviewComparisonByItem).toEqual({});
    expect(nextState.reviewPreflightByItem).toEqual({});
    expect(nextState.parsedBlocks).toEqual([]);
    expect(nextState.validationErrors).toEqual([]);
    expect(nextState.selectedItemId).toBe(null);
    expect(nextState.selectedHunkId).toBe(null);
    expect(nextState.collapsedHunkIdsByItem).toEqual({});
    expect(nextState.collapsedDiffGroupIdsByItem).toEqual({});
    expect(nextState.parseWarnings).toEqual([]);
    expect(nextState.reviewComparisonError).toBe(null);
    expect(nextState.isEditing).toBe(false);
    expect(nextState.reviewView).toBe('unified');
  });
});
