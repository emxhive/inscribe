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

export type UnifiedDiffRowKind = 'hunk' | 'add' | 'remove';

export interface UnifiedDiffRow {
  id: string;
  hunkId: string;
  kind: UnifiedDiffRowKind;
  oldLine: number | null;
  newLine: number | null;
  marker: '@@' | '+' | '-';
  text: string;
}

export interface UnifiedDiffHunkModel {
  id: string;
  index: number;
  kind: OperationDiffHunk['kind'];
  header: string;
  oldStartLine: number;
  newStartLine: number;
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

  hunks.forEach((hunk, hunkIndex) => {
    const hunkRows: UnifiedDiffRow[] = [];
    const oldLines = splitDiffLines(hunk.oldText);
    const newLines = splitDiffLines(hunk.newText);
    const header = buildHunkHeader(hunk, hunkIndex, oldLines.length, newLines.length);

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
        oldLine: hunk.oldStartLine + index,
        newLine: null,
        marker: '-',
        text: line,
    }));

    const addedRows = newLines.map((line, index): UnifiedDiffRow => ({
        id: `${hunk.id}-new-${index}`,
        hunkId: hunk.id,
        kind: 'add',
        oldLine: null,
        newLine: hunk.newStartLine + index,
        marker: '+',
        text: line,
    }));

    hunkRows.push(...removedRows, ...addedRows);
    rows.push(...hunkRows);
    hunkModels.push({
      id: hunk.id,
      index: hunkIndex,
      kind: hunk.kind,
      header,
      oldStartLine: hunk.oldStartLine,
      newStartLine: hunk.newStartLine,
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

function buildHunkHeader(hunk: OperationDiffHunk, index: number, oldCount: number, newCount: number): string {
  return `Hunk ${index + 1} -${hunk.oldStartLine},${oldCount} +${hunk.newStartLine},${newCount}`;
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
