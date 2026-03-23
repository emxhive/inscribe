import * as fs from 'fs';
import type {
  ComparisonAnchorSide,
  ComparisonRange,
  Operation,
  OperationComparison,
  OperationComparisonRegion,
} from '@inscribe/shared';
import { deriveChangedSegment } from '../apply/restoreV2';
import { resolveRangeReplacement } from '../apply/resolveRangeReplacement';
import { resolveAndAssertWithinRepo } from '../paths/resolveAndAssertWithin';
import { getEffectiveIgnoreMatchers } from '../repository';

interface BuildRegionInput {
  id: string;
  oldContent: string;
  newContent: string;
  oldRange: ComparisonRange;
  newRange: ComparisonRange;
}

interface FinalizeComparisonInput {
  operation: Operation;
  oldContent: string;
  newContent: string;
  regions: OperationComparisonRegion[];
}

export function buildOperationComparison(operation: Operation, repoRoot: string): OperationComparison {
  const ignoreMatcher = getEffectiveIgnoreMatchers(repoRoot);
  const { resolvedPath } = resolveAndAssertWithinRepo(repoRoot, operation.file, ignoreMatcher);
  const oldContent = fs.existsSync(resolvedPath) ? fs.readFileSync(resolvedPath, 'utf-8') : '';

  switch (operation.type) {
    case 'create': {
      const newContent = operation.content;
      return finalizeOperationComparison({
        operation,
        oldContent,
        newContent,
        regions: buildTrimmedComparisonRegions(oldContent, newContent),
      });
    }

    case 'replace': {
      const newContent = operation.content;
      return finalizeOperationComparison({
        operation,
        oldContent,
        newContent,
        regions: buildTrimmedComparisonRegions(oldContent, newContent),
      });
    }

    case 'append': {
      const newContent = `${oldContent}${operation.content}`;
      return finalizeOperationComparison({
        operation,
        oldContent,
        newContent,
        regions: [
          createOperationComparisonRegion({
            id: 'region-0',
            oldContent,
            newContent,
            oldRange: { start: oldContent.length, end: oldContent.length },
            newRange: { start: oldContent.length, end: newContent.length },
          }),
        ],
      });
    }

    case 'range': {
      const { prefix, suffix, insert, replaceStart, replaceEnd } = resolveRangeReplacement(oldContent, operation);
      const newContent = `${prefix}${insert}${suffix}`;
      return finalizeOperationComparison({
        operation,
        oldContent,
        newContent,
        regions: [
          createOperationComparisonRegion({
            id: 'region-0',
            oldContent,
            newContent,
            oldRange: { start: replaceStart, end: replaceEnd },
            newRange: { start: prefix.length, end: prefix.length + insert.length },
          }),
        ],
      });
    }

    case 'delete': {
      const newContent = '';
      return finalizeOperationComparison({
        operation,
        oldContent,
        newContent,
        regions: buildTrimmedComparisonRegions(oldContent, newContent),
      });
    }

    default:
      throw new Error(`Unknown operation type: ${operation.type}`);
  }
}

export function finalizeOperationComparison({
  operation,
  oldContent,
  newContent,
  regions,
}: FinalizeComparisonInput): OperationComparison {
  let previousOldEnd = 0;
  let previousNewEnd = 0;

  for (const region of regions) {
    assertRangeWithinContent(region.oldRange, oldContent, 'old');
    assertRangeWithinContent(region.newRange, newContent, 'new');

    if (region.oldRange.start < previousOldEnd) {
      throw new Error('Comparison regions overlap in old content');
    }

    if (region.newRange.start < previousNewEnd) {
      throw new Error('Comparison regions overlap in new content');
    }

    previousOldEnd = region.oldRange.end;
    previousNewEnd = region.newRange.end;
  }

  return {
    type: operation.type,
    file: operation.file,
    oldContent,
    newContent,
    regions,
  };
}

function buildTrimmedComparisonRegions(oldContent: string, newContent: string): OperationComparisonRegion[] {
  const segment = deriveChangedSegment(oldContent, newContent);

  if (segment.beforeStart === segment.beforeEnd && segment.afterStart === segment.afterEnd) {
    return [];
  }

  return [
    createOperationComparisonRegion({
      id: 'region-0',
      oldContent,
      newContent,
      oldRange: { start: segment.beforeStart, end: segment.beforeEnd },
      newRange: { start: segment.afterStart, end: segment.afterEnd },
    }),
  ];
}

export function createOperationComparisonRegion({
  id,
  oldContent,
  newContent,
  oldRange,
  newRange,
}: BuildRegionInput): OperationComparisonRegion {
  assertRangeWithinContent(oldRange, oldContent, 'old');
  assertRangeWithinContent(newRange, newContent, 'new');

  const oldText = oldContent.slice(oldRange.start, oldRange.end);
  const newText = newContent.slice(newRange.start, newRange.end);
  const kind = resolveRegionKind(oldRange, newRange);

  return {
    id,
    kind,
    oldRange,
    newRange,
    oldText,
    newText,
    boundaries: {
      before: {
        oldOffset: oldRange.start,
        newOffset: newRange.start,
      },
      after: {
        oldOffset: oldRange.end,
        newOffset: newRange.end,
      },
    },
    compare: {
      oldRange,
      newRange,
    },
    renderAnchor: {
      oldOffset: oldRange.start,
      newOffset: newRange.start,
      side: resolveAnchorSide(kind, newContent, newRange),
    },
  };
}

function assertRangeWithinContent(range: ComparisonRange, content: string, label: 'old' | 'new'): void {
  if (range.start < 0 || range.end < range.start || range.end > content.length) {
    throw new Error(`Invalid ${label} comparison range: ${range.start}-${range.end}`);
  }
}

function resolveRegionKind(oldRange: ComparisonRange, newRange: ComparisonRange): OperationComparisonRegion['kind'] {
  const oldLength = oldRange.end - oldRange.start;
  const newLength = newRange.end - newRange.start;

  if (oldLength === 0 && newLength > 0) {
    return 'insert';
  }

  if (oldLength > 0 && newLength === 0) {
    return 'delete';
  }

  return 'replace';
}

function resolveAnchorSide(
  kind: OperationComparisonRegion['kind'],
  newContent: string,
  newRange: ComparisonRange
): ComparisonAnchorSide {
  if (kind !== 'delete') {
    return 'before';
  }

  if (newContent.length === 0) {
    return 'empty';
  }

  if (newRange.start < newContent.length) {
    return 'before';
  }

  return 'after';
}
