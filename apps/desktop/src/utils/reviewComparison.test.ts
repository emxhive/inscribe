import { describe, expect, it } from 'vitest';
import type { OperationComparison } from '@inscribe/shared';

import {
  buildReviewRenderModel,
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
});
