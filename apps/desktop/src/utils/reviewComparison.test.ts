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

  it('merges raw hunks when their display context overlaps', () => {
    const oldContent = numberedLines(10);
    const newContent = [
      'line 1',
      'line 2',
      'line 3',
      'line 4 changed',
      'line 5',
      'line 6 changed',
      'line 7',
      'line 8',
      'line 9',
      'line 10',
      '',
    ].join('\n');
    const comparison: OperationComparison = {
      type: 'replace_range',
      file: 'app/example.ts',
      oldContent,
      newContent,
      replacementRegions: [],
      regions: [],
      diffHunks: [
        {
          id: 'hunk-0',
          kind: 'replace',
          oldRange: rangeForLine(oldContent, 4, 'line 4\n'),
          newRange: rangeForLine(newContent, 4, 'line 4 changed\n'),
          oldText: 'line 4\n',
          newText: 'line 4 changed\n',
          oldStartLine: 4,
          oldEndLine: 4,
          newStartLine: 4,
          newEndLine: 4,
        },
        {
          id: 'hunk-1',
          kind: 'replace',
          oldRange: rangeForLine(oldContent, 6, 'line 6\n'),
          newRange: rangeForLine(newContent, 6, 'line 6 changed\n'),
          oldText: 'line 6\n',
          newText: 'line 6 changed\n',
          oldStartLine: 6,
          oldEndLine: 6,
          newStartLine: 6,
          newEndLine: 6,
        },
      ],
    };

    const model = buildUnifiedDiffModel(comparison);

    expect(model.hunks).toHaveLength(1);
    expect(model.hunks[0].id).toBe('display-hunk-0');
    expect(model.hunks[0].sourceHunkIds).toEqual(['hunk-0', 'hunk-1']);
    expect(model.hunks[0].rows.filter((row) => row.kind === 'context' && row.oldLine === 5)).toHaveLength(1);
    expect(model.hunks[0].rows.filter((row) => row.kind === 'remove').map((row) => row.hunkId)).toEqual([
      'hunk-0',
      'hunk-1',
    ]);
    expect(model.hunks[0].rows.filter((row) => row.kind === 'add').map((row) => row.hunkId)).toEqual([
      'hunk-0',
      'hunk-1',
    ]);
  });

  it('keeps distant raw hunks as separate display hunks', () => {
    const oldContent = numberedLines(14);
    const newContent = [
      'line 1',
      'line 2',
      'line 3 changed',
      'line 4',
      'line 5',
      'line 6',
      'line 7',
      'line 8',
      'line 9',
      'line 10',
      'line 11 changed',
      'line 12',
      'line 13',
      'line 14',
      '',
    ].join('\n');
    const comparison: OperationComparison = {
      type: 'replace_range',
      file: 'app/example.ts',
      oldContent,
      newContent,
      replacementRegions: [],
      regions: [],
      diffHunks: [
        {
          id: 'hunk-0',
          kind: 'replace',
          oldRange: rangeForLine(oldContent, 3, 'line 3\n'),
          newRange: rangeForLine(newContent, 3, 'line 3 changed\n'),
          oldText: 'line 3\n',
          newText: 'line 3 changed\n',
          oldStartLine: 3,
          oldEndLine: 3,
          newStartLine: 3,
          newEndLine: 3,
        },
        {
          id: 'hunk-1',
          kind: 'replace',
          oldRange: rangeForLine(oldContent, 11, 'line 11\n'),
          newRange: rangeForLine(newContent, 11, 'line 11 changed\n'),
          oldText: 'line 11\n',
          newText: 'line 11 changed\n',
          oldStartLine: 11,
          oldEndLine: 11,
          newStartLine: 11,
          newEndLine: 11,
        },
      ],
    };

    const model = buildUnifiedDiffModel(comparison);

    expect(model.hunks).toHaveLength(2);
    expect(model.hunks.map((hunk) => hunk.id)).toEqual(['display-hunk-0', 'display-hunk-1']);
    expect(model.hunks.map((hunk) => hunk.sourceHunkIds)).toEqual([['hunk-0'], ['hunk-1']]);
  });

  it('keeps insert and delete line numbers in display hunks', () => {
    const oldContent = 'alpha\nbeta\ngamma\ndelta\n';
    const newContent = 'alpha\ninserted\ngamma\ndelta\n';
    const comparison: OperationComparison = {
      type: 'replace_range',
      file: 'app/example.ts',
      oldContent,
      newContent,
      replacementRegions: [],
      regions: [],
      diffHunks: [
        {
          id: 'delete-0',
          kind: 'delete',
          oldRange: rangeForLine(oldContent, 2, 'beta\n'),
          newRange: { start: lineStartOffset(newContent, 2), end: lineStartOffset(newContent, 2) },
          oldText: 'beta\n',
          newText: '',
          oldStartLine: 2,
          oldEndLine: 2,
          newStartLine: 2,
          newEndLine: 2,
        },
        {
          id: 'insert-0',
          kind: 'insert',
          oldRange: { start: lineStartOffset(oldContent, 3), end: lineStartOffset(oldContent, 3) },
          newRange: rangeForLine(newContent, 2, 'inserted\n'),
          oldText: '',
          newText: 'inserted\n',
          oldStartLine: 3,
          oldEndLine: 3,
          newStartLine: 2,
          newEndLine: 2,
        },
      ],
    };

    const hunk = buildUnifiedDiffModel(comparison).hunks[0];

    expect(hunk.removedRows.map((row) => [row.hunkId, row.oldLine, row.newLine, row.text])).toEqual([
      ['delete-0', 2, null, 'beta'],
    ]);
    expect(hunk.addedRows.map((row) => [row.hunkId, row.oldLine, row.newLine, row.text])).toEqual([
      ['insert-0', null, 2, 'inserted'],
    ]);
  });
});

function numberedLines(count: number): string {
  return [...Array(count).keys()].map((index) => `line ${index + 1}`).concat('').join('\n');
}

function rangeForLine(content: string, lineNumber: number, text: string): { start: number; end: number } {
  const start = lineStartOffset(content, lineNumber);
  return { start, end: start + text.length };
}

function lineStartOffset(content: string, lineNumber: number): number {
  if (lineNumber <= 1) return 0;

  let currentLine = 1;
  for (let index = 0; index < content.length; index++) {
    if (content[index] !== '\n') continue;
    currentLine++;
    if (currentLine === lineNumber) {
      return index + 1;
    }
  }

  return content.length;
}
