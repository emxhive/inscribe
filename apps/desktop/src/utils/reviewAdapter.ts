import type {
  ReviewComparison,
  ReviewFile,
  ReviewItem,
} from '@/types';
import type {
  PreviewExecutionDTO,
  PreviewFinalFileDTO,
} from '@/ipc/previewTypes';
import type { OperationComparisonRegion } from '@inscribe/shared';
import { getLanguageFromFilename } from './language';
import { countLines } from './text';

export interface AdaptedReviewResult {
  reviewItems: ReviewItem[];
  reviewFiles: ReviewFile[];
}

function mapFinalRegions(file: PreviewFinalFileDTO): OperationComparisonRegion[] {
  return file.actualDiffHunks.map((hunk) => ({
    id: hunk.id,
    kind: hunk.kind,
    oldRange: hunk.oldRange,
    newRange: hunk.newRange,
    oldText: hunk.oldText,
    newText: hunk.newText,
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
  }));
}

function buildFinalComparison(file: PreviewFinalFileDTO): ReviewComparison {
  const regions = mapFinalRegions(file);
  return {
    type: 'final_file',
    file: file.filePath,
    oldContent: file.beforeContent,
    newContent: file.afterContent,
    diffHunks: file.actualDiffHunks,
    replacementRegions: regions,
    regions,
  };
}

/**
 * Adapts the frozen preview into two deliberately separate models:
 * final file mutations for Review, and slim operation metadata for provenance.
 */
export function adaptPreview(
  executions: PreviewExecutionDTO[],
  finalFiles: PreviewFinalFileDTO[],
): AdaptedReviewResult {
  const reviewItems: ReviewItem[] = [];
  const finalFileByPath = new Map(finalFiles.map((file) => [file.filePath, file]));
  const operationIdsByFile = new Map<string, string[]>();

  for (const exec of executions) {
    // Executions for net-zero file chains have no final Review row. Their
    // operation snapshots remain in the preview session only; provenance is
    // exposed for files that survive session collapse.
    if (!finalFileByPath.has(exec.filePath)) {
      continue;
    }
    const itemId = `${exec.operationIndex}-${exec.filePath}`;
    const finalFile = finalFileByPath.get(exec.filePath);
    const item: ReviewItem = {
      id: itemId,
      file: exec.filePath,
      strategy: exec.strategy,
      executionId: exec.executionId,
      operationIndex: exec.operationIndex,
      blockIndex: exec.blockIndex,
      filePath: exec.filePath,
      targetScope: exec.targetScope,
      language: getLanguageFromFilename(exec.filePath),
      lineCount: finalFile ? countLines(finalFile.afterContent) : 0,
      status: 'pending',
    };

    reviewItems.push(item);
    const operationIds = operationIdsByFile.get(exec.filePath) ?? [];
    operationIds.push(itemId);
    operationIdsByFile.set(exec.filePath, operationIds);
  }

  const reviewFiles = finalFiles.map((file): ReviewFile => ({
    id: file.filePath,
    filePath: file.filePath,
    language: getLanguageFromFilename(file.filePath),
    beforeExists: file.beforeExists,
    afterExists: file.afterExists,
    beforeFileHash: file.beforeFileHash,
    afterFileHash: file.afterFileHash,
    comparison: buildFinalComparison(file),
    operationIds: operationIdsByFile.get(file.filePath) ?? [],
  }));

  return {
    reviewItems,
    reviewFiles,
  };
}
