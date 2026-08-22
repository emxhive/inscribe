import type {
  ReviewComparison,
  V2ReviewFile,
  V2ReviewItem,
} from '@/types';
import type {
  PreviewV2ExecutionDTO,
  PreviewV2FinalFileDTO,
} from '@/ipc/previewV2Types';
import type { OperationComparisonRegion } from '@inscribe/shared';
import { getLanguageFromFilename } from './language';
import { countLines } from './text';

export interface AdaptedV2ReviewResult {
  reviewItems: V2ReviewItem[];
  v2ReviewFiles: V2ReviewFile[];
}

function mapFinalRegions(file: PreviewV2FinalFileDTO): OperationComparisonRegion[] {
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

function buildFinalComparison(file: PreviewV2FinalFileDTO): ReviewComparison {
  const regions = mapFinalRegions(file);
  return {
    type: 'v2_final_file',
    file: file.filePath,
    oldContent: file.beforeContent,
    newContent: file.afterContent,
    diffHunks: file.actualDiffHunks,
    replacementRegions: regions,
    regions,
  };
}

/**
 * Adapts the frozen V2 preview into two deliberately separate models:
 * final file mutations for Review, and slim operation metadata for provenance.
 */
export function adaptV2Preview(
  executions: PreviewV2ExecutionDTO[],
  finalFiles: PreviewV2FinalFileDTO[],
): AdaptedV2ReviewResult {
  const reviewItems: V2ReviewItem[] = [];
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
    const item: V2ReviewItem = {
      engineVersion: 'v2',
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

  const v2ReviewFiles = finalFiles.map((file): V2ReviewFile => ({
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
    v2ReviewFiles,
  };
}
