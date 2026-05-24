import * as fs from 'fs';
import type {
  ComparisonAnchorSide,
  ComparisonRange,
  Operation,
  OperationComparison,
  OperationComparisonRegion,
  OperationDiffHunk,
  OperationMode,
} from '@inscribe/shared';
import { deriveChangedSegment } from '../history/restoreV2';
import { getEffectiveIgnoreMatchers } from '../repo/ignoreRules';
import { diffLinesStable } from './lineDiff';
import { resolveOperationExecution } from '../operation/resolveOperationExecution';
import { enforcePathPolicy } from '../paths/pathPolicy';
import { getScopeState } from '../repo/scopeStore';

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
  const scopeRoots = getScopeState(repoRoot)?.scope ?? [];
  const { resolvedPath } = enforcePathPolicy(
    repoRoot,
    operation.file,
    operation.type as OperationMode,
    scopeRoots,
    ignoreMatcher
  );
  const oldContent = fs.existsSync(resolvedPath) ? fs.readFileSync(resolvedPath, 'utf-8') : '';

  const resolved = resolveOperationExecution(operation, { exists: fs.existsSync(resolvedPath), content: oldContent });
  const newContent = resolved.afterContent;
  if (resolved.kind === 'partial_replacement') {
    const replacement = resolved.replacement;
    const replacementRegion = createOperationComparisonRegion({
      id: 'window-0',
      oldContent,
      newContent,
      oldRange: { start: replacement.oldStart, end: replacement.oldEnd },
      newRange: { start: replacement.newStart, end: replacement.newEnd },
    });
    const diffHunks = buildLineDiffHunks(
      replacement.oldText,
      replacement.newText,
      { oldBase: replacement.oldStart, newBase: replacement.newStart, replacementRegionId: replacementRegion.id }
    );
    return finalizeOperationComparison({ operation, oldContent, newContent, replacementRegions: [replacementRegion], diffHunks });
  }

  const replacementRegions = buildTrimmedComparisonRegions(oldContent, newContent);
  const diffHunks = buildLineDiffHunks(oldContent, newContent);
  return finalizeOperationComparison({ operation, oldContent, newContent, replacementRegions, diffHunks });
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
  const parts = diffLinesStable(oldText, newText);
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
