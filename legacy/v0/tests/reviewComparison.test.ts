import { describe, expect, it } from 'vitest';
import type { OperationComparison } from '@inscribe/shared';

import {
  buildReviewRenderModel,
  buildUnifiedDiffModel,
  buildReviewRegionOverlay,
  summarizeDeletedText,
} from './reviewComparison';

describe('reviewComparison utils', () => {
  it('builds a result-first render model directly from canonical comparison data', () => {
    const comparison: OperationComparison = {
      type: 'range',
      file: 'app/example.ts',
      oldContent: 'alpha\nbeta\ngamma\n',
      newContent: 'alpha\nupdated\ngamma\n',
      replacementRegions: [
        {
          id: 'region-0',
          kind: 'replace',
          oldRange: { start: 6, end: 11 },
          newRange: { start: 6, end: 14 },
          oldText: 'beta\n',
          newText: 'updated\n',
          boundaries: { before: { oldOffset: 6, newOffset: 6 }, after: { oldOffset: 11, newOffset: 14 } },
          compare: { oldRange: { start: 6, end: 11 }, newRange: { start: 6, end: 14 } },
          renderAnchor: { oldOffset: 6, newOffset: 6, side: 'before' },
        },
        {
          id: 'region-1',
          kind: 'delete',
          oldRange: { start: 11, end: 17 },
          newRange: { start: 14, end: 14 },
          oldText: 'gone\n',
          newText: '',
          boundaries: { before: { oldOffset: 11, newOffset: 14 }, after: { oldOffset: 17, newOffset: 14 } },
          compare: { oldRange: { start: 11, end: 17 }, newRange: { start: 14, end: 14 } },
          renderAnchor: { oldOffset: 11, newOffset: 14, side: 'before' },
        },
      ],
      diffHunks: [],
      regions: [
        {
          id: 'region-0',
          kind: 'replace',
          oldRange: { start: 6, end: 11 },
          newRange: { start: 6, end: 14 },
          oldText: 'beta\n',
          newText: 'updated\n',
          boundaries: {
            before: { oldOffset: 6, newOffset: 6 },
            after: { oldOffset: 11, newOffset: 14 },
          },
          compare: {
            oldRange: { start: 6, end: 11 },
            newRange: { start: 6, end: 14 },
          },
          renderAnchor: {
            oldOffset: 6,
            newOffset: 6,
            side: 'before',
          },
        },
        {
          id: 'region-1',
          kind: 'delete',
          oldRange: { start: 11, end: 17 },
          newRange: { start: 14, end: 14 },
          oldText: 'gone\n',
          newText: '',
          boundaries: {
            before: { oldOffset: 11, newOffset: 14 },
            after: { oldOffset: 17, newOffset: 14 },
          },
          compare: {
            oldRange: { start: 11, end: 17 },
            newRange: { start: 14, end: 14 },
          },
          renderAnchor: {
            oldOffset: 11,
            newOffset: 14,
            side: 'before',
          },
        },
      ],
    };

    expect(buildReviewRenderModel(comparison)).toEqual({
      content: 'alpha\nupdated\ngamma\n',
      regions: [
        {
          id: 'region-0',
          kind: 'replace',
          oldText: 'beta\n',
          newText: 'updated\n',
          highlightStart: 6,
          highlightEnd: 14,
          anchorOffset: 6,
          anchorSide: 'before',
          deletedSummary: null,
        },
        {
          id: 'region-1',
          kind: 'delete',
          oldText: 'gone\n',
          newText: '',
          highlightStart: 14,
          highlightEnd: 14,
          anchorOffset: 14,
          anchorSide: 'before',
          deletedSummary: 'Deleted: gone',
        },
      ],
      windows: [
        { id: 'region-0', start: 6, end: 14 },
        { id: 'region-1', start: 14, end: 14 },
      ],
    });
  });

  it('builds local overlay copy without re-diffing the file', () => {
    expect(buildReviewRegionOverlay({
      id: 'region-0',
      kind: 'delete',
      oldRange: { start: 0, end: 4 },
      newRange: { start: 2, end: 2 },
      oldText: 'gone',
      newText: '',
      boundaries: {
        before: { oldOffset: 0, newOffset: 2 },
        after: { oldOffset: 4, newOffset: 2 },
      },
      compare: {
        oldRange: { start: 0, end: 4 },
        newRange: { start: 2, end: 2 },
      },
      renderAnchor: {
        oldOffset: 0,
        newOffset: 2,
        side: 'before',
      },
    })).toEqual({
      title: 'Deleted content',
      oldLabel: 'Before',
      newLabel: 'After deletion',
      oldText: 'gone',
      newText: '(empty)',
    });
  });

  it('summarizes multiline deleted text for calm inline placeholders', () => {
    expect(summarizeDeletedText('first line\nsecond line\n')).toBe('Deleted 2 lines');
  });

  it('builds unified diff rows from engine-owned hunks', () => {
    const comparison: OperationComparison = {
      type: 'range',
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
          oldStartLine: 2,
          oldEndLine: 2,
          newStartLine: 2,
          newEndLine: 2,
          replacementRegionId: 'window-0',
        },
      ],
    };

    expect(buildUnifiedDiffModel(comparison)).toEqual({
      file: 'app/example.ts',
      hunks: [
        {
          id: 'hunk-0',
          index: 0,
          kind: 'replace',
          header: 'Hunk 1 -2,1 +2,1',
          oldStartLine: 2,
          newStartLine: 2,
          removedCount: 1,
          addedCount: 1,
          removedRows: [
            {
              id: 'hunk-0-old-0',
              hunkId: 'hunk-0',
              kind: 'remove',
              oldLine: 2,
              newLine: null,
              marker: '-',
              text: 'beta',
            },
          ],
          addedRows: [
            {
              id: 'hunk-0-new-0',
              hunkId: 'hunk-0',
              kind: 'add',
              oldLine: null,
              newLine: 2,
              marker: '+',
              text: 'updated',
            },
          ],
          rows: [
            {
              id: 'hunk-0-old-0',
              hunkId: 'hunk-0',
              kind: 'remove',
              oldLine: 2,
              newLine: null,
              marker: '-',
              text: 'beta',
            },
            {
              id: 'hunk-0-new-0',
              hunkId: 'hunk-0',
              kind: 'add',
              oldLine: null,
              newLine: 2,
              marker: '+',
              text: 'updated',
            },
          ],
        },
      ],
      rows: [
        {
          id: 'hunk-0-header',
          hunkId: 'hunk-0',
          kind: 'hunk',
          oldLine: null,
          newLine: null,
          marker: '@@',
          text: 'Hunk 1 -2,1 +2,1',
        },
        {
          id: 'hunk-0-old-0',
          hunkId: 'hunk-0',
          kind: 'remove',
          oldLine: 2,
          newLine: null,
          marker: '-',
          text: 'beta',
        },
        {
          id: 'hunk-0-new-0',
          hunkId: 'hunk-0',
          kind: 'add',
          oldLine: null,
          newLine: 2,
          marker: '+',
          text: 'updated',
        },
      ],
    });
  });

  it('handles insert and delete hunks without fake line rows', () => {
    const comparison: OperationComparison = {
      type: 'append',
      file: 'app/example.ts',
      oldContent: 'alpha\n',
      newContent: 'alpha\nbeta\n',
      replacementRegions: [],
      regions: [],
      diffHunks: [
        {
          id: 'hunk-0',
          kind: 'insert',
          oldRange: { start: 6, end: 6 },
          newRange: { start: 6, end: 11 },
          oldText: '',
          newText: 'beta\n',
          oldStartLine: 2,
          oldEndLine: 2,
          newStartLine: 2,
          newEndLine: 2,
        },
        {
          id: 'hunk-1',
          kind: 'delete',
          oldRange: { start: 0, end: 6 },
          newRange: { start: 0, end: 0 },
          oldText: 'alpha\n',
          newText: '',
          oldStartLine: 1,
          oldEndLine: 1,
          newStartLine: 1,
          newEndLine: 1,
        },
      ],
    };

    const rows = buildUnifiedDiffModel(comparison).rows;

    expect(rows.map((row) => row.kind)).toEqual(['hunk', 'add', 'hunk', 'remove']);
    expect(rows[0].text).toBe('Hunk 1 -2,0 +2,1');
    expect(rows[2].text).toBe('Hunk 2 -1,1 +1,0');
  });

  it('groups unified diff hunks for foldable rendering', () => {
    const comparison: OperationComparison = {
      type: 'replace',
      file: 'app/example.ts',
      oldContent: 'old one\nold two\n',
      newContent: 'new one\nnew two\n',
      replacementRegions: [],
      regions: [],
      diffHunks: [
        {
          id: 'hunk-0',
          kind: 'replace',
          oldRange: { start: 0, end: 16 },
          newRange: { start: 0, end: 16 },
          oldText: 'old one\nold two\n',
          newText: 'new one\nnew two\n',
          oldStartLine: 1,
          oldEndLine: 2,
          newStartLine: 1,
          newEndLine: 2,
        },
      ],
    };

    const model = buildUnifiedDiffModel(comparison);

    expect(model.hunks).toHaveLength(1);
    expect(model.hunks[0].removedCount).toBe(2);
    expect(model.hunks[0].addedCount).toBe(2);
    expect(model.hunks[0].removedRows).toHaveLength(2);
    expect(model.hunks[0].addedRows).toHaveLength(2);
    expect(model.hunks[0].rows.map((row) => row.kind)).toEqual(['remove', 'remove', 'add', 'add']);
  });
});
