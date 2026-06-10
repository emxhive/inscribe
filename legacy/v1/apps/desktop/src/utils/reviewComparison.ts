import type { ComparisonAnchorSide, OperationComparison, OperationComparisonRegion, OperationDiffHunk } from '@inscribe/shared';

export interface ReviewRenderableRegion {
  id: string;
  kind: OperationComparisonRegion['kind'];
  oldText: string;
  newText: string;
  highlightStart: number;
  highlightEnd: number;
  anchorOffset: number;
  anchorSide: ComparisonAnchorSide;
  deletedSummary: string | null;
}

export interface ReviewRenderModel {
  content: string;
  regions: ReviewRenderableRegion[];
  windows: Array<{ id: string; start: number; end: number }>;
}

export interface ReviewRegionOverlayModel {
  title: string;
  oldLabel: string;
  newLabel: string;
  oldText: string;
  newText: string;
}

const DEFAULT_DIFF_CONTEXT_LINES = 3;

export type UnifiedDiffRowKind = 'hunk' | 'context' | 'add' | 'remove';

export interface UnifiedDiffRow {
  id: string;
  hunkId: string;
  kind: UnifiedDiffRowKind;
  oldLine: number | null;
  newLine: number | null;
  marker: '@@' | ' ' | '+' | '-';
  text: string;
}

export interface UnifiedDiffHunkModel {
  id: string;
  index: number;
  kind: OperationDiffHunk['kind'];
  header: string;
  oldStartLine: number;
  newStartLine: number;
  beforeContextRows: UnifiedDiffRow[];
  afterContextRows: UnifiedDiffRow[];
  removedCount: number;
  addedCount: number;
  removedRows: UnifiedDiffRow[];
  addedRows: UnifiedDiffRow[];
  rows: UnifiedDiffRow[];
}

export interface UnifiedDiffModel {
  file: string;
  rows: UnifiedDiffRow[];
  hunks: UnifiedDiffHunkModel[];
}

export function buildResultReviewModel(comparison: OperationComparison): ReviewRenderModel {
  const hunks = (comparison.diffHunks?.length ?? 0) > 0 ? comparison.diffHunks! : comparison.regions;
  return {
    content: comparison.newContent,
    regions: hunks.map((region) => ({
      id: region.id,
      kind: region.kind,
      oldText: region.oldText,
      newText: region.newText,
      highlightStart: region.newRange.start,
      highlightEnd: region.newRange.end,
      anchorOffset: 'renderAnchor' in region ? region.renderAnchor.newOffset : region.newRange.start,
      anchorSide: 'renderAnchor' in region ? region.renderAnchor.side : 'before',
      deletedSummary: region.kind === 'delete' ? summarizeDeletedText(region.oldText) : null,
    })),
    windows: (comparison.replacementRegions ?? comparison.regions).map((region) => ({
      id: region.id,
      start: region.newRange.start,
      end: region.newRange.end,
    })),
  };
}

export const buildReviewRenderModel = buildResultReviewModel;

export function buildUnifiedDiffModel(comparison: OperationComparison): UnifiedDiffModel {
  const hunks = comparison.diffHunks ?? [];
  const rows: UnifiedDiffRow[] = [];
  const hunkModels: UnifiedDiffHunkModel[] = [];
  const oldSourceLines = splitSourceLines(comparison.oldContent);
  const newSourceLines = splitSourceLines(comparison.newContent);

  hunks.forEach((hunk, hunkIndex) => {
    const hunkRows: UnifiedDiffRow[] = [];
    const oldLines = splitDiffLines(hunk.oldText);
    const newLines = splitDiffLines(hunk.newText);
    const oldStartLine = lineAtOffset(comparison.oldContent, hunk.oldRange.start);
    const newStartLine = lineAtOffset(comparison.newContent, hunk.newRange.start);
    const header = buildHunkHeader(hunk, hunkIndex, oldStartLine, newStartLine, oldLines.length, newLines.length);
    const beforeContextRows = buildContextRows({
      hunkId: hunk.id,
      idPrefix: 'before-context',
      oldSourceLines,
      newSourceLines,
      oldStartLine: Math.max(1, oldStartLine - DEFAULT_DIFF_CONTEXT_LINES),
      newStartLine: Math.max(1, newStartLine - DEFAULT_DIFF_CONTEXT_LINES),
      count: Math.min(DEFAULT_DIFF_CONTEXT_LINES, oldStartLine - 1, newStartLine - 1),
    });

    const headerRow: UnifiedDiffRow = {
      id: `${hunk.id}-header`,
      hunkId: hunk.id,
      kind: 'hunk',
      oldLine: null,
      newLine: null,
      marker: '@@',
      text: header,
    };
    rows.push(headerRow);

    const removedRows = oldLines.map((line, index): UnifiedDiffRow => ({
        id: `${hunk.id}-old-${index}`,
        hunkId: hunk.id,
        kind: 'remove',
        oldLine: oldStartLine + index,
        newLine: null,
        marker: '-',
        text: line,
    }));

    const addedRows = newLines.map((line, index): UnifiedDiffRow => ({
        id: `${hunk.id}-new-${index}`,
        hunkId: hunk.id,
        kind: 'add',
        oldLine: null,
        newLine: newStartLine + index,
        marker: '+',
        text: line,
    }));

    const oldAfterStartLine = oldStartLine + oldLines.length;
    const newAfterStartLine = newStartLine + newLines.length;
    const afterContextRows = buildContextRows({
      hunkId: hunk.id,
      idPrefix: 'after-context',
      oldSourceLines,
      newSourceLines,
      oldStartLine: oldAfterStartLine,
      newStartLine: newAfterStartLine,
      count: Math.min(
        DEFAULT_DIFF_CONTEXT_LINES,
        oldSourceLines.length - oldAfterStartLine + 1,
        newSourceLines.length - newAfterStartLine + 1,
      ),
    });

    hunkRows.push(...beforeContextRows, ...removedRows, ...addedRows, ...afterContextRows);
    rows.push(...hunkRows);
    hunkModels.push({
      id: hunk.id,
      index: hunkIndex,
      kind: hunk.kind,
      header,
      oldStartLine,
      newStartLine,
      beforeContextRows,
      afterContextRows,
      removedCount: oldLines.length,
      addedCount: newLines.length,
      removedRows,
      addedRows,
      rows: hunkRows,
    });
  });

  return { file: comparison.file, rows, hunks: hunkModels };
}

export function buildReviewRegionOverlay(region: OperationComparisonRegion | OperationDiffHunk): ReviewRegionOverlayModel {
  return {
    title: getRegionTitle(region.kind),
    oldLabel: region.kind === 'insert' ? 'Insertion point' : 'Before',
    newLabel: region.kind === 'delete' ? 'After deletion' : 'After',
    oldText: region.oldText || '(empty)',
    newText: region.newText || '(empty)',
  };
}

export function summarizeDeletedText(text: string): string {
  const normalized = text.replace(/\n+$/, '');
  const lines = normalized.length > 0 ? normalized.split('\n') : [];
  if (lines.length === 0) {
    return 'Deleted empty region';
  }

  if (lines.length === 1) {
    const snippet = lines[0].length > 36 ? `${lines[0].slice(0, 33)}...` : lines[0];
    return `Deleted: ${snippet}`;
  }

  return `Deleted ${lines.length} lines`;
}

function getRegionTitle(kind: OperationComparisonRegion['kind']): string {
  switch (kind) {
    case 'insert':
      return 'Inserted content';
    case 'delete':
      return 'Deleted content';
    case 'replace':
    default:
      return 'Replaced content';
  }
}

function buildHunkHeader(
  _hunk: OperationDiffHunk,
  index: number,
  oldStartLine: number,
  newStartLine: number,
  oldCount: number,
  newCount: number,
): string {
  return `Hunk ${index + 1} -${oldStartLine},${oldCount} +${newStartLine},${newCount}`;
}

function lineAtOffset(content: string, offset: number): number {
  if (offset <= 0) return 1;
  return content.slice(0, Math.min(offset, content.length)).split('\n').length;
}

function splitDiffLines(text: string): string[] {
  if (!text) {
    return [];
  }

  const normalized = text.endsWith('\n') ? text.slice(0, -1) : text;
  if (!normalized) {
    return [''];
  }

  return normalized.split('\n');
}

interface SourceLine {
  lineNumber: number;
  text: string;
}

function splitSourceLines(text: string): SourceLine[] {
  if (!text) {
    return [];
  }

  const normalized = text.endsWith('\n') ? text.slice(0, -1) : text;
  if (!normalized) {
    return [{ lineNumber: 1, text: '' }];
  }

  return normalized.split('\n').map((line, index) => ({
    lineNumber: index + 1,
    text: line,
  }));
}

function buildContextRows({
  hunkId,
  idPrefix,
  oldSourceLines,
  newSourceLines,
  oldStartLine,
  newStartLine,
  count,
}: {
  hunkId: string;
  idPrefix: string;
  oldSourceLines: SourceLine[];
  newSourceLines: SourceLine[];
  oldStartLine: number;
  newStartLine: number;
  count: number;
}): UnifiedDiffRow[] {
  if (count <= 0) {
    return [];
  }

  return Array.from({ length: count }, (_, index): UnifiedDiffRow => {
    const oldLineNumber = oldStartLine + index;
    const newLineNumber = newStartLine + index;
    const oldLine = oldSourceLines[oldLineNumber - 1] ?? null;
    const newLine = newSourceLines[newLineNumber - 1] ?? null;

    return {
      id: `${hunkId}-${idPrefix}-${index}`,
      hunkId,
      kind: 'context',
      oldLine: oldLine?.lineNumber ?? oldLineNumber,
      newLine: newLine?.lineNumber ?? newLineNumber,
      marker: ' ',
      text: newLine?.text ?? oldLine?.text ?? '',
    };
  });
}
