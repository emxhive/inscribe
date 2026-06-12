import type {
  ReviewItem,
  ReviewComparisonSnapshot,
  ReviewPreflightResult,
  ReviewComparison,
} from '@/types';
import type { PreviewV2ExecutionDTO } from '@/ipc/previewV2Types';
import type { OperationComparisonRegion } from '@inscribe/shared';
import { getLanguageFromFilename } from './language';
import { countLines } from './text';
import { buildReviewItemPreflightFingerprint } from './review';

export interface AdaptedV2ReviewResult {
  reviewItems: ReviewItem[];
  reviewComparisonByItem: Record<string, ReviewComparisonSnapshot>;
  reviewPreflightByItem: Record<string, ReviewPreflightResult>;
}

/**
 * Maps PreviewV2ExecutionDTOs into renderer review items, comparison snapshots, and preloaded preflight entries.
 */
export function adaptV2Executions(
  executions: PreviewV2ExecutionDTO[]
): AdaptedV2ReviewResult {
  const reviewItems: ReviewItem[] = [];
  const reviewComparisonByItem: Record<string, ReviewComparisonSnapshot> = {};
  const reviewPreflightByItem: Record<string, ReviewPreflightResult> = {};

  for (const exec of executions) {
    const itemId = `${exec.operationIndex}-${exec.filePath}`;

    const item: ReviewItem = {
      engineVersion: 'v2',
      comparisonSource: 'canonical-v2',
      id: itemId,
      file: exec.filePath,
      strategy: exec.strategy,
      executionId: exec.executionId,
      operationIndex: exec.operationIndex,
      filePath: exec.filePath,
      beforeFileHash: exec.beforeFileHash,
      afterFileHash: exec.afterFileHash,
      targetScope: exec.targetScope,
      beforeExists: exec.beforeExists,
      afterExists: exec.afterExists,
      language: getLanguageFromFilename(exec.filePath),
      lineCount: countLines(exec.afterContent),
      status: 'pending',
      originalContent: exec.beforeContent,
      editedContent: exec.afterContent,
    };

    reviewItems.push(item);

    // Build compatibility regions for Option A
    const mappedRegions: OperationComparisonRegion[] = exec.actualDiffHunks.map((hunk) => {
      const oldText = hunk.oldText !== undefined ? hunk.oldText : exec.beforeContent.slice(hunk.oldRange.start, hunk.oldRange.end);
      const newText = hunk.newText !== undefined ? hunk.newText : exec.afterContent.slice(hunk.newRange.start, hunk.newRange.end);
      return {
        id: hunk.id,
        kind: hunk.kind,
        oldRange: hunk.oldRange,
        newRange: hunk.newRange,
        oldText,
        newText,
        boundaries: {
          before: { oldOffset: hunk.oldRange.start, newOffset: hunk.newRange.start },
          after: { oldOffset: hunk.oldRange.end, newOffset: hunk.newRange.end },
        },
        compare: {
          oldRange: hunk.oldRange,
          newRange: hunk.newRange,
        },
        renderAnchor: {
          oldOffset: hunk.oldRange.start,
          newOffset: hunk.newRange.start,
          side: hunk.kind === 'insert' ? 'empty' : 'before',
        },
      };
    });

    const comparison: ReviewComparison = {
      type: exec.strategy,
      file: exec.filePath,
      oldContent: exec.beforeContent,
      newContent: exec.afterContent,
      diffHunks: exec.actualDiffHunks,
      replacementRegions: mappedRegions,
      regions: mappedRegions,
    };

    const fingerprint = buildReviewItemPreflightFingerprint(item);

    reviewComparisonByItem[itemId] = {
      fingerprint,
      comparison,
    };

    reviewPreflightByItem[itemId] = {
      status: 'passed',
      fingerprint,
    };
  }

  return {
    reviewItems,
    reviewComparisonByItem,
    reviewPreflightByItem,
  };
}
