import { describe, expect, it } from 'vitest';
import type { PreviewErrorDTO } from '@/ipc/previewTypes';
import type {
  ReviewFile,
  ReviewItem,
} from '@/types';
import {
  buildPreviewFailureUpdate,
  buildPreviewNoChangesUpdate,
  buildPreviewReadyUpdate,
  buildPreviewRequestFailureUpdate,
  buildPreviewStartedUpdate,
} from './previewTransitions';

const diagnostics = [
  {
    type: 'protocol',
    code: 'INVALID_MODE',
    message: 'Invalid mode.',
    blockIndex: 1,
  },
] as PreviewErrorDTO[];

const diagnosticTarget = {
  blockId: 'block-2',
  lineIndex: 12,
};

describe('preview state transitions', () => {
  it('starts preview and invalidates the immediate revert target', () => {
    expect(
      buildPreviewStartedUpdate(
        'Previewing changes...',
      ),
    ).toMatchObject({
      isParsingInProgress: true,
      pipelineStatus: 'parsing',
      previewDiagnostics: [],
      lastAppliedActionId: null,
      statusMessage: 'Previewing changes...',
    });
  });

  it('moves a failed preview back to intake with diagnostics selected', () => {
    const update = buildPreviewFailureUpdate(
      diagnostics,
      diagnosticTarget,
    );

    expect(update).toMatchObject({
      mode: 'intake',
      reviewItems: [],
      reviewFiles: [],
      selectedReviewFileId: null,
      selectedIntakeBlockId: 'block-2',
      selectedIntakeLineIndex: 12,
      rightPanelOwner: 'inspector',
      rightPanelView: 'diagnostics',
      pipelineStatus: 'parse-failure',
      isParsingInProgress: false,
      previewSession: null,
    });

    expect(update.previewDiagnostics).toBe(
      diagnostics,
    );
  });

  it('represents a partial preview with no reviewable file changes', () => {
    const update =
      buildPreviewNoChangesUpdate(
        diagnostics,
        diagnosticTarget,
        1,
      );

    expect(update).toMatchObject({
      mode: 'intake',
      pipelineStatus: 'parse-partial',
      rightPanelView: 'diagnostics',
      selectedIntakeBlockId: 'block-2',
      selectedIntakeLineIndex: 12,
      previewSession: null,
    });
  });

  it('builds a full successful review transition', () => {
    const reviewItems = [
      { id: 'operation-1' },
    ] as ReviewItem[];

    const reviewFiles = [
      { id: 'file-1' },
    ] as ReviewFile[];

    const update = buildPreviewReadyUpdate({
      reviewItems,
      reviewFiles,
      diagnostics: [],
      diagnosticTarget: null,
      selectedIntakeBlockId: 'block-1',
      partial: false,
      excludedBlockCount: 0,
      previewToken: 'preview-token',
      expiresAt: 'later',
    });

    expect(update).toMatchObject({
      mode: 'review',
      reviewItems,
      reviewFiles,
      selectedReviewFileId: 'file-1',
      selectedIntakeBlockId: 'block-1',
      selectedIntakeLineIndex: null,
      rightPanelView: 'properties',
      pipelineStatus: 'parse-success',
      isParsingInProgress: false,
      previewSession: {
        previewToken: 'preview-token',
        expiresAt: 'later',
      },
    });
  });

  it('keeps a partial successful preview in intake and selects its diagnostic', () => {
    const reviewItems = [
      { id: 'operation-1' },
    ] as ReviewItem[];

    const reviewFiles = [
      { id: 'file-1' },
    ] as ReviewFile[];

    const update = buildPreviewReadyUpdate({
      reviewItems,
      reviewFiles,
      diagnostics,
      diagnosticTarget,
      selectedIntakeBlockId: 'block-1',
      partial: true,
      excludedBlockCount: 1,
      previewToken: 'preview-token',
      expiresAt: 'later',
    });

    expect(update).toMatchObject({
      mode: 'intake',
      selectedIntakeBlockId: 'block-2',
      selectedIntakeLineIndex: 12,
      rightPanelView: 'diagnostics',
      pipelineStatus: 'parse-partial',
    });
  });

  it('normalizes unexpected preview request failure state', () => {
    const update =
      buildPreviewRequestFailureUpdate();

    expect(update).toMatchObject({
      mode: 'intake',
      reviewItems: [],
      reviewFiles: [],
      selectedReviewFileId: null,
      rightPanelView: 'diagnostics',
      pipelineStatus: 'parse-failure',
      isParsingInProgress: false,
      previewSession: null,
    });

    expect(update.previewDiagnostics).toEqual([
      expect.objectContaining({
        code: 'PREVIEW_REQUEST_FAILED',
      }),
    ]);
  });
});