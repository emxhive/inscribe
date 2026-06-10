import { describe, expect, it } from 'vitest';
import type { OperationComparison } from '@inscribe/shared';

import { buildUnifiedDiffModel } from './reviewComparison';

describe('buildUnifiedDiffModel', () => {
  it('adds surrounding context rows to unified diff hunks', () => {
    const comparison: OperationComparison = {
      type: 'replace_range',
      file: 'app/example.ts',
      oldContent: [
        'one',
        'two',
        'three',
        'four',
        'five',
        'six',
        'seven',
        '',
      ].join('\n'),
      newContent: [
        'one',
        'two',
        'three',
        'changed',
        'five',
        'six',
        'seven',
        '',
      ].join('\n'),
      replacementRegions: [],
      regions: [],
      diffHunks: [
        {
          id: 'hunk-0',
          kind: 'replace',
          oldRange: { start: 14, end: 19 },
          newRange: { start: 14, end: 22 },
          oldText: 'four\n',
          newText: 'changed\n',
          oldStartLine: 4,
          oldEndLine: 4,
          newStartLine: 4,
          newEndLine: 4,
        },
      ],
    };

    const hunk = buildUnifiedDiffModel(comparison).hunks[0];

    expect(hunk.beforeContextRows.map((row) => [row.oldLine, row.newLine, row.marker, row.text])).toEqual([
      [1, 1, ' ', 'one'],
      [2, 2, ' ', 'two'],
      [3, 3, ' ', 'three'],
    ]);
    expect(hunk.afterContextRows.map((row) => [row.oldLine, row.newLine, row.marker, row.text])).toEqual([
      [5, 5, ' ', 'five'],
      [6, 6, ' ', 'six'],
      [7, 7, ' ', 'seven'],
    ]);
    expect(hunk.rows.map((row) => row.kind)).toEqual([
      'context',
      'context',
      'context',
      'remove',
      'add',
      'context',
      'context',
      'context',
    ]);
  });

  it('uses full-file hunk ranges for line numbers when hunk text is window-local', () => {
    const comparison: OperationComparison = {
      type: 'replace_range',
      file: 'app/example.ts',
      oldContent: 'alpha\nbeta\ngamma\n',
      newContent: 'alpha\nupdated\ngamma\n',
      replacementRegions: [],
      regions: [],
      diffHunks: [
        {
          id: 'hunk-0',
          kind: 'replace',
          oldRange: { start: 6, end: 11 },
          newRange: { start: 6, end: 14 },
          oldText: 'beta\n',
          newText: 'updated\n',
          oldStartLine: 1,
          oldEndLine: 1,
          newStartLine: 1,
          newEndLine: 1,
          replacementRegionId: 'window-0',
        },
      ],
    };

    const hunk = buildUnifiedDiffModel(comparison).hunks[0];

    expect(hunk.header).toBe('Hunk 1 -2,1 +2,1');
    expect(hunk.removedRows[0].oldLine).toBe(2);
    expect(hunk.addedRows[0].newLine).toBe(2);
  });
});
