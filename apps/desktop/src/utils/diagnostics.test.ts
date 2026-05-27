import { describe, expect, it } from 'vitest';
import type { AppState } from '@/types';
import { initialState } from '@/hooks/useAppState';
import type { IntakeBlock } from './intake';
import { buildDiagnosticGroups } from './diagnostics';

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
});
