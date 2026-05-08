import * as fs from 'fs';
import type {
  ComparisonAnchorSide,
  ComparisonRange,
  Operation,
  OperationComparison,
  OperationComparisonRegion,
  OperationDiffHunk,
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
  replacementRegions?: OperationComparisonRegion[];
  diffHunks?: OperationDiffHunk[];
  regions?: OperationComparisonRegion[];
}

export function buildOperationComparison(operation: Operation, repoRoot: string): OperationComparison {
  const ignoreMatcher = getEffectiveIgnoreMatchers(repoRoot);
  const { resolvedPath } = resolveAndAssertWithinRepo(repoRoot, operation.file, ignoreMatcher);
  const oldContent = fs.existsSync(resolvedPath) ? fs.readFileSync(resolvedPath, 'utf-8') : '';

  switch (operation.type) {
    case 'create': {
      const newContent = operation.content;
      const replacementRegions = buildTrimmedComparisonRegions(oldContent, newContent);
      const diffHunks = buildLineDiffHunks(oldContent, newContent);
      return finalizeOperationComparison({ operation, oldContent, newContent, replacementRegions, diffHunks });
    }

    case 'replace': {
      const newContent = operation.content;
      const replacementRegions = buildTrimmedComparisonRegions(oldContent, newContent);
      const diffHunks = buildLineDiffHunks(oldContent, newContent);
      return finalizeOperationComparison({ operation, oldContent, newContent, replacementRegions, diffHunks });
    }

    case 'append': {
      const newContent = `${oldContent}${operation.content}`;
      const replacementRegions = [
        createOperationComparisonRegion({
          id: 'window-0',
          oldContent,
          newContent,
          oldRange: { start: oldContent.length, end: oldContent.length },
          newRange: { start: oldContent.length, end: newContent.length },
        }),
      ];
      const diffHunks = buildLineDiffHunks(oldContent, newContent);
      return finalizeOperationComparison({ operation, oldContent, newContent, replacementRegions, diffHunks });
    }

    case 'range': {
      const { prefix, suffix, insert, replaceStart, replaceEnd } = resolveRangeReplacement(oldContent, operation);
      const newContent = `${prefix}${insert}${suffix}`;
      const replacementRegion = createOperationComparisonRegion({
        id: 'window-0',
        oldContent,
        newContent,
        oldRange: { start: replaceStart, end: replaceEnd },
        newRange: { start: prefix.length, end: prefix.length + insert.length },
      });
      const diffHunks = buildLineDiffHunks(
        oldContent.slice(replaceStart, replaceEnd),
        insert,
        { oldBase: replaceStart, newBase: prefix.length, replacementRegionId: replacementRegion.id }
      );
      return finalizeOperationComparison({
        operation,
        oldContent,
        newContent,
        replacementRegions: [replacementRegion],
        diffHunks,
      });
    }

    case 'delete': {
      const newContent = '';
      const replacementRegions = buildTrimmedComparisonRegions(oldContent, newContent);
      const diffHunks = buildLineDiffHunks(oldContent, newContent);
      return finalizeOperationComparison({ operation, oldContent, newContent, replacementRegions, diffHunks });
    }

    default:
      throw new Error(`Unknown operation type: ${operation.type}`);
  }
}

export function finalizeOperationComparison({
  operation,
  oldContent,
  newContent,
  replacementRegions,
  diffHunks,
  regions,
}: FinalizeComparisonInput): OperationComparison {
  const windows = replacementRegions ?? regions ?? [];
  const hunks = diffHunks ?? buildLineDiffHunks(oldContent, newContent);
  let previousOldEnd = 0;
  let previousNewEnd = 0;

  for (const region of windows) {
    assertRangeWithinContent(region.oldRange, oldContent, 'old');
    assertRangeWithinContent(region.newRange, newContent, 'new');

    if (region.oldRange.start < previousOldEnd) throw new Error('Comparison regions overlap in old content');
    if (region.newRange.start < previousNewEnd) throw new Error('Comparison regions overlap in new content');

    previousOldEnd = region.oldRange.end;
    previousNewEnd = region.newRange.end;
  }

  return {
    type: operation.type,
    file: operation.file,
    oldContent,
    newContent,
    replacementRegions: windows,
    diffHunks: hunks,
    regions: windows,
  };
}

function buildTrimmedComparisonRegions(oldContent: string, newContent: string): OperationComparisonRegion[] {
  const segment = deriveChangedSegment(oldContent, newContent);
  if (segment.beforeStart === segment.beforeEnd && segment.afterStart === segment.afterEnd) return [];

  return [
    createOperationComparisonRegion({
      id: 'window-0',
      oldContent,
      newContent,
      oldRange: { start: segment.beforeStart, end: segment.beforeEnd },
      newRange: { start: segment.afterStart, end: segment.afterEnd },
    }),
  ];
}

function lineAtOffset(content: string, offset: number): number {
  if (offset <= 0) return 1;
  return content.slice(0, Math.min(offset, content.length)).split('\n').length;
}

function buildLineDiffHunks(
  oldText: string,
  newText: string,
  options: { oldBase?: number; newBase?: number; replacementRegionId?: string } = {}
): OperationDiffHunk[] {
  const hunks: OperationDiffHunk[] = [];
  const parts = diffByLines(oldText, newText);
  let oldCursor = 0;
  let newCursor = 0;
  let i = 0;

  while (i < parts.length) {
    const part = parts[i];
    if (!part.added && !part.removed) {
      oldCursor += part.value.length;
      newCursor += part.value.length;
      i++;
      continue;
    }

    const oldStart = oldCursor;
    const newStart = newCursor;
    let oldChunk = '';
    let newChunk = '';

    if (part.removed) {
      oldChunk += part.value;
      oldCursor += part.value.length;
      if (parts[i + 1]?.added) {
        newChunk += parts[i + 1].value;
        newCursor += parts[i + 1].value.length;
        i++;
      }
    } else if (part.added) {
      newChunk += part.value;
      newCursor += part.value.length;
    }

    const oldBase = options.oldBase ?? 0;
    const newBase = options.newBase ?? 0;
    const oldRange = { start: oldBase + oldStart, end: oldBase + oldStart + oldChunk.length };
    const newRange = { start: newBase + newStart, end: newBase + newStart + newChunk.length };
    const oldEndLine = oldRange.start === oldRange.end ? lineAtOffset(oldText, oldStart) : lineAtOffset(oldText, oldStart + oldChunk.length);
    const newEndLine = newRange.start === newRange.end ? lineAtOffset(newText, newStart) : lineAtOffset(newText, newStart + newChunk.length);

    hunks.push({
      id: `hunk-${hunks.length}`,
      kind: oldChunk.length === 0 ? 'insert' : newChunk.length === 0 ? 'delete' : 'replace',
      oldRange,
      newRange,
      oldText: oldChunk,
      newText: newChunk,
      oldStartLine: lineAtOffset(oldText, oldStart),
      oldEndLine,
      newStartLine: lineAtOffset(newText, newStart),
      newEndLine,
      replacementRegionId: options.replacementRegionId,
    });
    i++;
  }

  return hunks;
}

function splitLinesWithNewline(text: string): string[] {
  if (!text) return [];
  const lines = text.match(/[^\n]*\n|[^\n]+$/g);
  return lines ?? [];
}

function diffByLines(oldText: string, newText: string): Array<{ value: string; added?: boolean; removed?: boolean }> {
  const a = splitLinesWithNewline(oldText);
  const b = splitLinesWithNewline(newText);
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const parts: Array<{ value: string; added?: boolean; removed?: boolean }> = [];
  let i = 0;
  let j = 0;
  const push = (piece: { value: string; added?: boolean; removed?: boolean }) => {
    const last = parts[parts.length - 1];
    if (last && last.added === piece.added && last.removed === piece.removed) {
      last.value += piece.value;
    } else {
      parts.push({ ...piece });
    }
  };
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      push({ value: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      push({ value: a[i], removed: true });
      i++;
    } else {
      push({ value: b[j], added: true });
      j++;
    }
  }
  while (i < a.length) push({ value: a[i++], removed: true });
  while (j < b.length) push({ value: b[j++], added: true });
  return parts;
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
    boundaries: { before: { oldOffset: oldRange.start, newOffset: newRange.start }, after: { oldOffset: oldRange.end, newOffset: newRange.end } },
    compare: { oldRange, newRange },
    renderAnchor: { oldOffset: oldRange.start, newOffset: newRange.start, side: resolveAnchorSide(kind, newContent, newRange) },
  };
}

function assertRangeWithinContent(range: ComparisonRange, content: string, label: 'old' | 'new'): void {
  if (range.start < 0 || range.end < range.start || range.end > content.length) throw new Error(`Invalid ${label} comparison range: ${range.start}-${range.end}`);
}

function resolveRegionKind(oldRange: ComparisonRange, newRange: ComparisonRange): OperationComparisonRegion['kind'] {
  const oldLength = oldRange.end - oldRange.start;
  const newLength = newRange.end - newRange.start;
  if (oldLength === 0 && newLength > 0) return 'insert';
  if (oldLength > 0 && newLength === 0) return 'delete';
  return 'replace';
}

function resolveAnchorSide(kind: OperationComparisonRegion['kind'], newContent: string, newRange: ComparisonRange): ComparisonAnchorSide {
  if (kind !== 'delete') return 'before';
  if (newContent.length === 0) return 'empty';
  if (newRange.start < newContent.length) return 'before';
  return 'after';
}
