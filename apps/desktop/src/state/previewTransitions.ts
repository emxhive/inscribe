import type { PreviewErrorDTO } from '@/ipc/previewTypes';
import type {
  AppState,
  ReviewFile,
  ReviewItem,
} from '@/types';

export type PreviewDiagnosticTarget = {
  blockId: string;
  lineIndex: number | null;
} | null;

type PreviewReadyOptions = {
  reviewItems: ReviewItem[];
  reviewFiles: ReviewFile[];
  diagnostics: PreviewErrorDTO[];
  diagnosticTarget: PreviewDiagnosticTarget;
  selectedIntakeBlockId: string | null;
  partial: boolean;
  excludedBlockCount: number;
  previewToken: string;
  expiresAt: string;
};

function clearedReviewState(): Partial<AppState> {
  return {
    reviewItems: [],
    reviewFiles: [],
    selectedReviewFileId: null,
    selectedHunkId: null,
    collapsedHunkIdsByFile: {},
    collapsedDiffGroupIdsByFile: {},
    reviewView: 'unified',
    previewSession: null,
  };
}

export function buildPreviewStartedUpdate(
  statusMessage: string,
): Partial<AppState> {
  return {
    pipelineStatus: 'parsing',
    previewDiagnostics: [],
    lastAppliedActionId: null,
    statusMessage,
  };
}

export function buildPreviewFailureUpdate(
  diagnostics: PreviewErrorDTO[],
  diagnosticTarget: PreviewDiagnosticTarget,
): Partial<AppState> {
  return {
    ...clearedReviewState(),
    selectedIntakeBlockId:
      diagnosticTarget?.blockId ?? null,
    selectedIntakeLineIndex:
      diagnosticTarget?.lineIndex ?? null,
    parseErrors: [],
    previewDiagnostics: diagnostics,
    rightPanelOwner: 'inspector',
    rightPanelView: 'diagnostics',
    statusMessage: `preview failed: ${diagnostics.length} error(s)`,
    pipelineStatus: 'parse-failure',
    mode: 'intake',
  };
}

export function buildPreviewNoChangesUpdate(
  diagnostics: PreviewErrorDTO[],
  diagnosticTarget: PreviewDiagnosticTarget,
  excludedBlockCount: number,
): Partial<AppState> {
  const excludedCount =
    excludedBlockCount || diagnostics.length;

  return {
    ...clearedReviewState(),
    selectedIntakeBlockId:
      diagnosticTarget?.blockId ?? null,
    selectedIntakeLineIndex:
      diagnosticTarget?.lineIndex ?? null,
    parseErrors: [],
    previewDiagnostics: diagnostics,
    rightPanelOwner: 'inspector',
    rightPanelView:
      diagnostics.length > 0
        ? 'diagnostics'
        : 'properties',
    mode: 'intake',
    pipelineStatus:
      diagnostics.length > 0
        ? 'parse-partial'
        : 'parse-success',
    statusMessage:
      diagnostics.length > 0
        ? `No net changes to review; ${excludedCount} block${
            excludedCount === 1 ? '' : 's'
          } excluded.`
        : 'No net changes to review.',
  };
}

export function buildPreviewReadyUpdate({
  reviewItems,
  reviewFiles,
  diagnostics,
  diagnosticTarget,
  selectedIntakeBlockId,
  partial,
  excludedBlockCount,
  previewToken,
  expiresAt,
}: PreviewReadyOptions): Partial<AppState> {
  const excludedCount =
    excludedBlockCount || diagnostics.length;

  return {
    reviewItems,
    reviewFiles,
    parseErrors: [],
    previewDiagnostics: diagnostics,
    selectedReviewFileId: reviewFiles[0].id,
    selectedIntakeBlockId: partial
      ? diagnosticTarget?.blockId ?? null
      : selectedIntakeBlockId,
    selectedIntakeLineIndex: partial
      ? diagnosticTarget?.lineIndex ?? null
      : null,
    rightPanelOwner: 'inspector',
    rightPanelView: partial
      ? 'diagnostics'
      : 'properties',
    selectedHunkId: null,
    collapsedHunkIdsByFile: {},
    collapsedDiffGroupIdsByFile: {},
    reviewView: 'unified',
    mode: partial ? 'intake' : 'review',
    pipelineStatus: partial
      ? 'parse-partial'
      : 'parse-success',
    statusMessage: partial
      ? `Previewed ${reviewFiles.length} final file${
          reviewFiles.length === 1 ? '' : 's'
        }; ${excludedCount} block${
          excludedCount === 1 ? '' : 's'
        } excluded.`
      : `Ready to review: ${reviewFiles.length} file${
          reviewFiles.length === 1 ? '' : 's'
        }`,
    previewSession: {
      previewToken,
      expiresAt,
    },
  };
}

export function buildPreviewRequestFailureUpdate(): Partial<AppState> {
  return {
    ...clearedReviewState(),
    selectedIntakeLineIndex: null,
    rightPanelOwner: 'inspector',
    rightPanelView: 'diagnostics',
    parseErrors: [],
    previewDiagnostics: [
      {
        type: 'system',
        code: 'PREVIEW_REQUEST_FAILED',
        message: 'preview request failed.',
      },
    ],
    statusMessage: 'Failed preview',
    pipelineStatus: 'parse-failure',
    mode: 'intake',
  };
}