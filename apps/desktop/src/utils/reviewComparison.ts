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

export function buildReviewRenderModel(comparison: OperationComparison): ReviewRenderModel {
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
