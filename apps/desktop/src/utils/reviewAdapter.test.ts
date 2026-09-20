import { describe, expect, it } from 'vitest';
import { adaptPreview } from './reviewAdapter';
import { buildResultReviewModel, buildUnifiedDiffModel } from './reviewComparison';
import type { PreviewExecutionDTO, PreviewFinalFileDTO } from '@/ipc/previewTypes';

const finalHunk = {
  id: 'final-hunk',
  kind: 'replace' as const,
  oldRange: { start: 0, end: 1 },
  newRange: { start: 0, end: 1 },
  oldText: 'before',
  newText: 'after',
  oldStartLine: 1,
  oldEndLine: 1,
  newStartLine: 1,
  newEndLine: 1,
};

const replaceExecution = (overrides: Partial<PreviewExecutionDTO> = {}): PreviewExecutionDTO => ({
  operationIndex: 0,
  blockIndex: 0,
  executionId: 'exec-0',
  filePath: 'src/main.ts',
  strategy: 'replace_text',
  targetScope: { filePath: 'src/main.ts', strategy: 'replace_text' },
  beforeExists: true,
  afterExists: true,
  beforeContent: 'before\n',
  afterContent: 'after\n',
  beforeFileHash: 'hash-before',
  afterFileHash: 'hash-after',
  actualDiffHunks: [],
  ...overrides,
});

const finalFile: PreviewFinalFileDTO = {
  filePath: 'src/main.ts',
  beforeExists: true,
  afterExists: true,
  beforeContent: 'before\n',
  afterContent: 'after\n',
  beforeFileHash: 'final-before',
  afterFileHash: 'final-after',
  actualDiffHunks: [finalHunk],
};

describe('reviewAdapter', () => {
  it('creates provenance items and one canonical final-file model', () => {
    const result = adaptPreview(
      [
        replaceExecution(),
        replaceExecution({
          operationIndex: 1,
          blockIndex: 1,
          executionId: 'exec-1',
          beforeContent: 'after\n',
          afterContent: 'final\n',
        }),
      ],
      [finalFile],
    );

    expect(result.reviewItems.map((item) => item.id)).toEqual([
      '0-src/main.ts',
      '1-src/main.ts',
    ]);
    expect(result.reviewFiles).toHaveLength(1);
    expect(result.reviewFiles[0]).toMatchObject({
      id: 'src/main.ts',
      filePath: 'src/main.ts',
      beforeFileHash: 'final-before',
      afterFileHash: 'final-after',
      operationIds: ['0-src/main.ts', '1-src/main.ts'],
    });
    expect(result.reviewFiles[0].comparison.oldContent).toBe('before\n');
    expect(result.reviewFiles[0].comparison.newContent).toBe('after\n');
  });

  it('keeps review items strictly as provenance metadata', () => {
    const result = adaptPreview([replaceExecution()], [finalFile]);
    const item = result.reviewItems[0];

    expect(item).toMatchObject({
      strategy: 'replace_text',
      executionId: 'exec-0',
      operationIndex: 0,
      blockIndex: 0,
      filePath: 'src/main.ts',
    });
    expect(item).not.toHaveProperty('originalContent');
    expect(item).not.toHaveProperty('editedContent');
    expect(item).not.toHaveProperty('beforeFileHash');
    expect(item).not.toHaveProperty('afterFileHash');
    expect(item).not.toHaveProperty('beforeExists');
    expect(item).not.toHaveProperty('afterExists');
  });

  it('renders only the canonical final-file comparison', () => {
    const result = adaptPreview([replaceExecution()], [finalFile]);
    const comparison = result.reviewFiles[0].comparison;
    const resultModel = buildResultReviewModel(comparison);
    const diffModel = buildUnifiedDiffModel(comparison);

    expect(resultModel.content).toBe('after\n');
    expect(resultModel.regions).toHaveLength(1);
    expect(resultModel.regions[0].id).toBe('final-hunk');
    expect(diffModel.file).toBe('src/main.ts');
    expect(diffModel.hunks).toHaveLength(1);
    expect(diffModel.hunks[0]).toMatchObject({ addedCount: 1, removedCount: 1 });
  });

  it('omits operations for net-zero files when no final mutation survives collapse', () => {
    const result = adaptPreview(
      [replaceExecution({ filePath: 'src/net-zero.ts' })],
      [],
    );

    expect(result.reviewItems).toEqual([]);
    expect(result.reviewFiles).toEqual([]);
  });

  it('retains match metadata only in contributing operation provenance', () => {
    const result = adaptPreview(
      [replaceExecution({
        targetScope: {
          filePath: 'src/main.ts',
          strategy: 'replace_text',
          matchMetadata: {
            kind: 'fallback',
            score: 0.98,
            resolvedRange: { start: 0, end: 1 },
            fallbackReason: 'exact_not_found',
            unmatchedSoftTokens: [';'],
          },
        },
      })],
      [finalFile],
    );

    const item = result.reviewItems[0];
    expect(item.targetScope.matchMetadata).toMatchObject({
      kind: 'fallback',
      score: 0.98,
    });
  });
});
