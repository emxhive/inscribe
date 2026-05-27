import { describe, expect, it } from 'vitest';
import type { AppState } from '@/types';
import { initialState } from '@/hooks/useAppState';
import type { IntakeBlock } from './intake';
import { buildDiagnosticGroups, formatDiagnosticGroupForClipboard } from './diagnostics';
import { buildReviewItemPreflightFingerprint } from './review';

const block: IntakeBlock = {
  id: 'block-1',
  index: 0,
  startLine: 0,
  endLine: 4,
  directives: {},
  warnings: [],
  errors: [],
  status: 'valid',
  label: 'src/app.ts',
};

const withState = (updates: Partial<AppState>): AppState => ({
  ...initialState,
  ...updates,
});

describe('diagnostics utils', () => {
  it('returns no diagnostic groups when there are no messages', () => {
    expect(buildDiagnosticGroups(initialState, [])).toEqual([]);
  });

  it('groups parse and intake block issues', () => {
    const groups = buildDiagnosticGroups(
      withState({ parseErrors: ['Missing END marker'] }),
      [{ ...block, warnings: ['Missing MODE header'], status: 'warning' }],
    );

    expect(groups.map((group) => group.id)).toEqual(['parse-errors', 'intake']);
    expect(groups[0].messages).toEqual(['Missing END marker']);
    expect(groups[1].messages).toEqual(['src/app.ts: Missing MODE header']);
  });

  it('scopes diagnostics to the active intake or review mode', () => {
    const reviewItem = {
      id: '0-src/app.ts',
      file: 'src/app.ts',
      mode: 'replace_file' as const,
      language: 'typescript',
      lineCount: 1,
      status: 'invalid' as const,
      originalContent: '',
      editedContent: '',
      validationError: 'File does not exist',
      blockIndex: 0,
      directives: {},
    };
    const state = withState({
      parseErrors: ['Missing END marker'],
      validationErrors: [{ blockIndex: 0, file: 'src/app.ts', message: 'File does not exist' }],
      reviewItems: [reviewItem],
    });

    expect(buildDiagnosticGroups(state, [block], { scope: 'intake' }).map((group) => group.id)).toEqual([
      'parse-errors',
    ]);
    expect(buildDiagnosticGroups(state, [block], { scope: 'review' }).map((group) => group.id)).toEqual([
      'validation',
    ]);
  });

  it('deduplicates validation errors from state and review items', () => {
    const groups = buildDiagnosticGroups(
      withState({
        validationErrors: [{ blockIndex: 0, file: 'src/app.ts', message: 'File does not exist' }],
        reviewItems: [
          {
            id: '0-src/app.ts',
            file: 'src/app.ts',
            mode: 'replace_file',
            language: 'typescript',
            lineCount: 1,
            status: 'invalid',
            originalContent: '',
            editedContent: '',
            validationError: 'File does not exist',
            blockIndex: 0,
            directives: {},
          },
        ],
      }),
      [],
    );

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      id: 'validation',
      messages: ['src/app.ts: File does not exist'],
    });
  });

  it('groups repository and apply/restore failures', () => {
    const groups = buildDiagnosticGroups(
      withState({
        indexStatus: { state: 'error', message: 'Index failed' },
        pipelineStatus: 'apply-failure',
        statusMessage: 'Failed to apply: denied',
        historyItems: [
          {
            id: 'history-1',
            applyId: 'apply-1',
            file: 'src/app.ts',
            mode: 'replace_file',
            createdAt: '2026-05-12T00:00:00.000Z',
            restoreOperation: { type: 'replace_file', file: 'src/app.ts', content: '' },
            restoreStatus: 'apply-failed',
            restoreMessage: 'Restore failed',
          },
        ],
      }),
      [],
    );

    expect(groups.map((group) => group.id)).toEqual(['repository', 'apply-restore']);
    expect(groups[0].messages).toEqual(['Index failed']);
    expect(groups[1].messages).toEqual(['Failed to apply: denied', 'src/app.ts: Restore failed']);
  });

  it('shows all item-level comparison/preflight blockers together', () => {
    const firstItem = {
      id: '0-src/app.ts',
      file: 'src/app.ts',
      mode: 'replace_file' as const,
      language: 'typescript',
      lineCount: 1,
      status: 'pending' as const,
      originalContent: '',
      editedContent: '',
      blockIndex: 0,
      directives: {},
    };
    const secondItem = {
      ...firstItem,
      id: '1-src/other.ts',
      file: 'src/other.ts',
      blockIndex: 1,
    };
    const groups = buildDiagnosticGroups(
      withState({
        reviewItems: [firstItem, secondItem],
        reviewPreflightByItem: {
          [firstItem.id]: {
            status: 'failed',
            fingerprint: buildReviewItemPreflightFingerprint(firstItem),
            error: 'No range candidate matched boundary selectors',
          },
          [secondItem.id]: {
            status: 'failed',
            fingerprint: buildReviewItemPreflightFingerprint(secondItem),
            error: 'Target content changed',
          },
        },
      }),
      [],
    );

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      id: 'comparison',
      messages: [
        'src/app.ts: No range candidate matched boundary selectors',
        'src/other.ts: Target content changed',
      ],
    });
  });

  it('formats copied diagnostics with group title and bullet messages', () => {
    expect(formatDiagnosticGroupForClipboard({
      id: 'comparison',
      title: 'Review Comparison Errors',
      severity: 'error',
      messages: ['src/app.ts: No range candidate matched'],
    })).toBe('Review Comparison Errors (error)\n- src/app.ts: No range candidate matched');
  });
});
