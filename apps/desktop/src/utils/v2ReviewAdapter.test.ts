import { describe, expect, it } from 'vitest';
import { adaptV2Preview } from './v2ReviewAdapter';
import { buildResultReviewModel, buildUnifiedDiffModel } from './reviewComparison';
import type { PreviewV2ExecutionDTO, PreviewV2FinalFileDTO } from '@/ipc/previewV2Types';

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

const replaceExecution = (overrides: Partial<PreviewV2ExecutionDTO> = {}): PreviewV2ExecutionDTO => ({
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

const finalFile: PreviewV2FinalFileDTO = {
  filePath: 'src/main.ts',
  beforeExists: true,
  afterExists: true,
  beforeContent: 'before\n',
  afterContent: 'after\n',
  beforeFileHash: 'final-before',
  afterFileHash: 'final-after',
  actualDiffHunks: [finalHunk],
};

describe('v2ReviewAdapter', () => {
  it('creates provenance items and one canonical final-file model', () => {
    const result = adaptV2Preview(
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
    expect(result.v2ReviewFiles).toHaveLength(1);
    expect(result.v2ReviewFiles[0]).toMatchObject({
      id: 'src/main.ts',
      filePath: 'src/main.ts',
      beforeFileHash: 'final-before',
      afterFileHash: 'final-after',
      operationIds: ['0-src/main.ts', '1-src/main.ts'],
    });
    expect(result.v2ReviewFiles[0].comparison.oldContent).toBe('before\n');
    expect(result.v2ReviewFiles[0].comparison.newContent).toBe('after\n');
  });

  it('keeps V2 review items strictly as provenance metadata', () => {
    const result = adaptV2Preview([replaceExecution()], [finalFile]);
    const item = result.reviewItems[0];

    expect(item.engineVersion).toBe('v2');
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
    const result = adaptV2Preview([replaceExecution()], [finalFile]);
    const comparison = result.v2ReviewFiles[0].comparison;
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
    const result = adaptV2Preview(
      [replaceExecution({ filePath: 'src/net-zero.ts' })],
      [],
    );

    expect(result.reviewItems).toEqual([]);
    expect(result.v2ReviewFiles).toEqual([]);
  });

  it('retains match metadata only in contributing operation provenance', () => {
    const result = adaptV2Preview(
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
    expect(item.engineVersion === 'v2' && item.targetScope.matchMetadata).toMatchObject({
      kind: 'fallback',
      score: 0.98,
    });
  });
});
