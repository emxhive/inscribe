import { describe, expect, it } from 'vitest';
import { adaptV2Executions } from './v2ReviewAdapter';
import { buildResultReviewModel, buildUnifiedDiffModel } from './reviewComparison';
import type { PreviewV2ExecutionDTO } from '@/ipc/previewV2Types';

describe('v2ReviewAdapter', () => {
  const mockReplaceExecution: PreviewV2ExecutionDTO = {
    operationIndex: 0,
    executionId: 'exec-replace',
    filePath: 'src/main.ts',
    strategy: 'replace_text',
    targetScope: { filePath: 'src/main.ts', strategy: 'replace_text' },
    beforeExists: true,
    afterExists: true,
    beforeContent: 'console.log("hello");\n',
    afterContent: 'console.log("world");\n',
    beforeFileHash: 'hash-before-replace',
    afterFileHash: 'hash-after-replace',
    actualDiffHunks: [
      {
        id: 'hunk-replace',
        kind: 'replace',
        oldRange: { start: 13, end: 18 },
        newRange: { start: 13, end: 18 },
        oldText: 'hello',
        newText: 'world',
        oldStartLine: 1,
        oldEndLine: 1,
        newStartLine: 1,
        newEndLine: 1,
      },
    ],
  };

  const mockInsertExecution: PreviewV2ExecutionDTO = {
    operationIndex: 1,
    executionId: 'exec-insert',
    filePath: 'src/insert.ts',
    strategy: 'replace_text',
    targetScope: { filePath: 'src/insert.ts', strategy: 'replace_text' },
    beforeExists: true,
    afterExists: true,
    beforeContent: 'console.log();\n',
    afterContent: 'console.log("inserted");\n',
    beforeFileHash: 'hash-before-insert',
    afterFileHash: 'hash-after-insert',
    actualDiffHunks: [
      {
        id: 'hunk-insert',
        kind: 'insert',
        oldRange: { start: 12, end: 12 },
        newRange: { start: 12, end: 22 },
        oldText: '',
        newText: '"inserted"',
        oldStartLine: 1,
        oldEndLine: 1,
        newStartLine: 1,
        newEndLine: 1,
      },
    ],
  };

  const mockDeleteExecution: PreviewV2ExecutionDTO = {
    operationIndex: 2,
    executionId: 'exec-delete',
    filePath: 'src/delete.ts',
    strategy: 'replace_text',
    targetScope: { filePath: 'src/delete.ts', strategy: 'replace_text' },
    beforeExists: true,
    afterExists: true,
    beforeContent: 'console.log("to_delete");\n',
    afterContent: 'console.log();\n',
    beforeFileHash: 'hash-before-delete',
    afterFileHash: 'hash-after-delete',
    actualDiffHunks: [
      {
        id: 'hunk-delete',
        kind: 'delete',
        oldRange: { start: 12, end: 23 },
        newRange: { start: 12, end: 12 },
        oldText: '"to_delete"',
        newText: '',
        oldStartLine: 1,
        oldEndLine: 1,
        newStartLine: 1,
        newEndLine: 1,
      },
    ],
  };

  const mockZeroWidthInsertExecution: PreviewV2ExecutionDTO = {
    operationIndex: 3,
    executionId: 'exec-zero-insert',
    filePath: 'src/zero-insert.ts',
    strategy: 'replace_text',
    targetScope: { filePath: 'src/zero-insert.ts', strategy: 'replace_text' },
    beforeExists: false,
    afterExists: true,
    beforeContent: '',
    afterContent: '',
    beforeFileHash: 'hash-before-zero-insert',
    afterFileHash: 'hash-after-zero-insert',
    actualDiffHunks: [
      {
        id: 'hunk-zero-insert',
        kind: 'insert',
        oldRange: { start: 0, end: 0 },
        newRange: { start: 0, end: 0 },
        oldText: '',
        newText: '',
        oldStartLine: 1,
        oldEndLine: 1,
        newStartLine: 1,
        newEndLine: 1,
      },
    ],
  };

  const mockZeroWidthDeleteExecution: PreviewV2ExecutionDTO = {
    operationIndex: 4,
    executionId: 'exec-zero-delete',
    filePath: 'src/zero-delete.ts',
    strategy: 'replace_text',
    targetScope: { filePath: 'src/zero-delete.ts', strategy: 'replace_text' },
    beforeExists: true,
    afterExists: false,
    beforeContent: '',
    afterContent: '',
    beforeFileHash: 'hash-before-zero-delete',
    afterFileHash: 'hash-after-zero-delete',
    actualDiffHunks: [
      {
        id: 'hunk-zero-delete',
        kind: 'delete',
        oldRange: { start: 0, end: 0 },
        newRange: { start: 0, end: 0 },
        oldText: '',
        newText: '',
        oldStartLine: 1,
        oldEndLine: 1,
        newStartLine: 1,
        newEndLine: 1,
      },
    ],
  };

  it('preserves operation order when adapting multiple executions', () => {
    const result = adaptV2Executions([
      mockReplaceExecution,
      mockInsertExecution,
      mockDeleteExecution,
    ]);

    expect(result.reviewItems).toHaveLength(3);
    expect(result.reviewItems[0].id).toBe('0-src/main.ts');
    expect(result.reviewItems[1].id).toBe('1-src/insert.ts');
    expect(result.reviewItems[2].id).toBe('2-src/delete.ts');
  });

  it('preserves all metadata fields: hashes, existence, targetScope, and strategy', () => {
    const result = adaptV2Executions([mockReplaceExecution]);
    const item = result.reviewItems[0];
    expect(item.engineVersion).toBe('v2');
    if (item.engineVersion === 'v2') {
      expect(item.beforeFileHash).toBe('hash-before-replace');
      expect(item.afterFileHash).toBe('hash-after-replace');
      expect(item.beforeExists).toBe(true);
      expect(item.afterExists).toBe(true);
      expect(item.targetScope).toEqual({ filePath: 'src/main.ts', strategy: 'replace_text' });
      expect(item.strategy).toBe('replace_text');
    }
  });

  it('preserves targetScope matchMetadata when adapting executions', () => {
    const execWithMeta: PreviewV2ExecutionDTO = {
      ...mockReplaceExecution,
      targetScope: {
        filePath: 'src/main.ts',
        strategy: 'replace_text',
        matchMetadata: {
          kind: 'fallback',
          score: 0.98,
          resolvedRange: { start: 10, end: 20 },
          fallbackReason: 'exact_not_found',
          unmatchedSoftTokens: [';']
        }
      }
    };
    const result = adaptV2Executions([execWithMeta]);
    const item = result.reviewItems[0];
    expect(item.engineVersion).toBe('v2');
    if (item.engineVersion === 'v2') {
      expect(item.targetScope.matchMetadata).toBeDefined();
      expect(item.targetScope.matchMetadata?.kind).toBe('fallback');
      expect(item.targetScope.matchMetadata?.score).toBe(0.98);
      expect(item.targetScope.matchMetadata?.resolvedRange).toEqual({ start: 10, end: 20 });
      expect(item.targetScope.matchMetadata?.unmatchedSoftTokens).toEqual([';']);
    }
  });

  it('verifies that comparison and preflight fingerprints match', () => {
    const result = adaptV2Executions([mockReplaceExecution]);
    const item = result.reviewItems[0];
    const snapshot = result.reviewComparisonByItem[item.id];
    const preflight = result.reviewPreflightByItem[item.id];
    expect(snapshot.fingerprint).toBe(preflight.fingerprint);
    expect(preflight.status).toBe('passed');
  });

  it('correctly adapts and renders a REPLACE operation', () => {
    const result = adaptV2Executions([mockReplaceExecution]);
    const comparison = result.reviewComparisonByItem['0-src/main.ts'].comparison;

    // Check buildResultReviewModel output
    const resultModel = buildResultReviewModel(comparison);
    expect(resultModel.content).toBe('console.log("world");\n');
    expect(resultModel.regions).toHaveLength(1);
    expect(resultModel.regions[0]).toEqual({
      id: 'hunk-replace',
      kind: 'replace',
      oldText: 'hello',
      newText: 'world',
      highlightStart: 13,
      highlightEnd: 18,
      anchorOffset: 13,
      anchorSide: 'before',
      deletedSummary: null,
    });

    // Check buildUnifiedDiffModel output
    const diffModel = buildUnifiedDiffModel(comparison);
    expect(diffModel.file).toBe('src/main.ts');
    expect(diffModel.hunks).toHaveLength(1);
    const hunk = diffModel.hunks[0];
    expect(hunk.kind).toBe('replace');
    expect(hunk.oldStartLine).toBe(1);
    expect(hunk.newStartLine).toBe(1);
    expect(hunk.removedCount).toBe(1);
    expect(hunk.addedCount).toBe(1);
  });

  it('correctly adapts and renders an INSERT operation', () => {
    const result = adaptV2Executions([mockInsertExecution]);
    const comparison = result.reviewComparisonByItem['1-src/insert.ts'].comparison;

    // Check buildResultReviewModel output
    const resultModel = buildResultReviewModel(comparison);
    expect(resultModel.content).toBe('console.log("inserted");\n');
    expect(resultModel.regions).toHaveLength(1);
    expect(resultModel.regions[0]).toEqual({
      id: 'hunk-insert',
      kind: 'insert',
      oldText: '',
      newText: '"inserted"',
      highlightStart: 12,
      highlightEnd: 22,
      anchorOffset: 12,
      anchorSide: 'empty',
      deletedSummary: null,
    });

    // Check buildUnifiedDiffModel output
    const diffModel = buildUnifiedDiffModel(comparison);
    expect(diffModel.hunks).toHaveLength(1);
    const hunk = diffModel.hunks[0];
    expect(hunk.kind).toBe('insert');
    expect(hunk.removedCount).toBe(0);
    expect(hunk.addedCount).toBe(1);
  });

  it('correctly adapts and renders a DELETE operation', () => {
    const result = adaptV2Executions([mockDeleteExecution]);
    const comparison = result.reviewComparisonByItem['2-src/delete.ts'].comparison;

    // Check buildResultReviewModel output
    const resultModel = buildResultReviewModel(comparison);
    expect(resultModel.content).toBe('console.log();\n');
    expect(resultModel.regions).toHaveLength(1);
    expect(resultModel.regions[0]).toEqual({
      id: 'hunk-delete',
      kind: 'delete',
      oldText: '"to_delete"',
      newText: '',
      highlightStart: 12,
      highlightEnd: 12,
      anchorOffset: 12,
      anchorSide: 'before',
      deletedSummary: 'Deleted: "to_delete"',
    });

    // Check buildUnifiedDiffModel output
    const diffModel = buildUnifiedDiffModel(comparison);
    expect(diffModel.hunks).toHaveLength(1);
    const hunk = diffModel.hunks[0];
    expect(hunk.kind).toBe('delete');
    expect(hunk.removedCount).toBe(1);
    expect(hunk.addedCount).toBe(0);
  });

  it('correctly adapts and renders zero-width insertions and deletions', () => {
    const result = adaptV2Executions([mockZeroWidthInsertExecution, mockZeroWidthDeleteExecution]);

    // Zero-width insert
    const insertComparison = result.reviewComparisonByItem['3-src/zero-insert.ts'].comparison;
    const insertResultModel = buildResultReviewModel(insertComparison);
    expect(insertResultModel.regions[0]).toMatchObject({
      id: 'hunk-zero-insert',
      kind: 'insert',
      highlightStart: 0,
      highlightEnd: 0,
      anchorOffset: 0,
      anchorSide: 'empty',
    });

    const insertDiffModel = buildUnifiedDiffModel(insertComparison);
    expect(insertDiffModel.hunks).toHaveLength(1);
    expect(insertDiffModel.hunks[0].kind).toBe('insert');
    expect(insertDiffModel.hunks[0].removedCount).toBe(0);
    expect(insertDiffModel.hunks[0].addedCount).toBe(0);

    // Zero-width delete
    const deleteComparison = result.reviewComparisonByItem['4-src/zero-delete.ts'].comparison;
    const deleteResultModel = buildResultReviewModel(deleteComparison);
    expect(deleteResultModel.regions[0]).toMatchObject({
      id: 'hunk-zero-delete',
      kind: 'delete',
      highlightStart: 0,
      highlightEnd: 0,
      anchorOffset: 0,
      anchorSide: 'before',
      deletedSummary: 'Deleted empty region',
    });

    const deleteDiffModel = buildUnifiedDiffModel(deleteComparison);
    expect(deleteDiffModel.hunks).toHaveLength(1);
    expect(deleteDiffModel.hunks[0].kind).toBe('delete');
    expect(deleteDiffModel.hunks[0].removedCount).toBe(0);
    expect(deleteDiffModel.hunks[0].addedCount).toBe(0);
  });
});
