import { findDiagnosticBlock, parseLiveIntakeStructure } from '@/utils';
import type { PreviewErrorDTO } from '@/ipc/previewTypes';
import { adaptPreview } from '@/utils/reviewAdapter';
import { useAppStateContext } from './useAppStateContext';

type UpdateAppState = ReturnType<
  typeof useAppStateContext
>['updateState'];

type PreviewIntakeOptions = {
  repoRoot: string | null;
  rawInput: string;
  indexedFileSet: Set<string>;
  selectedIntakeBlockId: string | null;
  updateState: UpdateAppState;
  startStatusMessage?: string;
};

function getFirstDiagnosticTarget(
  input: string,
  indexedFileSet: Set<string>,
  diagnostics: PreviewErrorDTO[],
): { blockId: string; lineIndex: number | null } | null {
  const structure = parseLiveIntakeStructure(input, { indexedFileSet });

  for (const diagnostic of diagnostics) {
    const block = findDiagnosticBlock(structure.blocks, diagnostic);

    if (block) {
      return {
        blockId: block.id,
        lineIndex:
          typeof diagnostic.line === 'number'
            ? Math.max(0, diagnostic.line - 1)
            : block.startLine,
      };
    }
  }

  return null;
}

export async function previewIntake({
  repoRoot,
  rawInput,
  indexedFileSet,
  selectedIntakeBlockId,
  updateState,
  startStatusMessage = 'Previewing changes...',
}: PreviewIntakeOptions): Promise<void> {
  if (!repoRoot) {
    updateState({
      statusMessage: 'Error: No repository selected',
      parseErrors: ['No repository selected. Please select a repository first.'],
      pipelineStatus: 'idle',
    });
    return;
  }

  if (!rawInput.trim()) {
    updateState({
      statusMessage: 'Error: No input provided',
      parseErrors: ['No input provided. Please paste AI response.'],
      pipelineStatus: 'idle',
    });
    return;
  }

  try {
    updateState({
      isParsingInProgress: true,
      pipelineStatus: 'parsing',
      previewDiagnostics: [],
      lastAppliedActionId: null,
      statusMessage: startStatusMessage,
    });

    const response = await window.inscribeAPI.preview({
      repoRoot,
      rawInput,
    });

    const firstDiagnosticTarget = getFirstDiagnosticTarget(
      rawInput,
      indexedFileSet,
      response.errors,
    );

    if (!response.ok) {
      updateState({
        reviewItems: [],
        reviewFiles: [],
        selectedReviewFileId: null,
        selectedIntakeBlockId: firstDiagnosticTarget?.blockId ?? null,
        selectedIntakeLineIndex: firstDiagnosticTarget?.lineIndex ?? null,
        parseErrors: [],
        parseWarnings: [],
        previewDiagnostics: response.errors,
        rightPanelOwner: 'inspector',
        rightPanelView: 'diagnostics',
        selectedHunkId: null,
        collapsedHunkIdsByFile: {},
        collapsedDiffGroupIdsByFile: {},
        reviewView: 'unified',
        statusMessage: `preview failed: ${response.errors.length} error(s)`,
        pipelineStatus: 'parse-failure',
        isParsingInProgress: false,
        mode: 'intake',
        previewSession: null,
      });
      return;
    }

    const adapted = adaptPreview(
      response.executions,
      response.finalFiles,
    );

    const excludedBlockCount = new Set(
      response.errors
        .filter((error) => typeof error.blockIndex === 'number')
        .map((error) => error.blockIndex),
    ).size;

    if (adapted.reviewFiles.length === 0) {
      updateState({
        reviewItems: [],
        reviewFiles: [],
        selectedReviewFileId: null,
        selectedIntakeBlockId: firstDiagnosticTarget?.blockId ?? null,
        selectedIntakeLineIndex: firstDiagnosticTarget?.lineIndex ?? null,
        parseErrors: [],
        parseWarnings: [],
        previewDiagnostics: response.errors,
        rightPanelOwner: 'inspector',
        rightPanelView:
          response.errors.length > 0
            ? 'diagnostics'
            : 'properties',
        selectedHunkId: null,
        collapsedHunkIdsByFile: {},
        collapsedDiffGroupIdsByFile: {},
        reviewView: 'unified',
        mode: 'intake',
        pipelineStatus:
          response.errors.length > 0
            ? 'parse-partial'
            : 'parse-success',
        isParsingInProgress: false,
        statusMessage:
          response.errors.length > 0
            ? `No net changes to review; ${
                excludedBlockCount || response.errors.length
              } block${
                (excludedBlockCount || response.errors.length) === 1
                  ? ''
                  : 's'
              } excluded.`
            : 'No net changes to review.',
        previewSession: null,
      });
      return;
    }

    updateState({
      reviewItems: adapted.reviewItems,
      reviewFiles: adapted.reviewFiles,
      parseErrors: [],
      parseWarnings: [],
      previewDiagnostics: response.errors,
      selectedReviewFileId: adapted.reviewFiles[0].id,
      selectedIntakeBlockId: response.partial
        ? firstDiagnosticTarget?.blockId ?? null
        : selectedIntakeBlockId,
      selectedIntakeLineIndex: response.partial
        ? firstDiagnosticTarget?.lineIndex ?? null
        : null,
      rightPanelOwner: 'inspector',
      rightPanelView: response.partial
        ? 'diagnostics'
        : 'properties',
      selectedHunkId: null,
      collapsedHunkIdsByFile: {},
      collapsedDiffGroupIdsByFile: {},
      reviewView: 'unified',
      mode: response.partial ? 'intake' : 'review',
      pipelineStatus: response.partial
        ? 'parse-partial'
        : 'parse-success',
      isParsingInProgress: false,
      statusMessage: response.partial
        ? `Previewed ${adapted.reviewFiles.length} final file${
            adapted.reviewFiles.length === 1 ? '' : 's'
          }; ${
            excludedBlockCount || response.errors.length
          } block${
            (excludedBlockCount || response.errors.length) === 1
              ? ''
              : 's'
          } excluded.`
        : `Ready to review: ${adapted.reviewFiles.length} file${
            adapted.reviewFiles.length === 1 ? '' : 's'
          }`,
      previewSession: {
        previewToken: response.previewToken,
        expiresAt: response.expiresAt,
      },
    });
  } catch (error) {
    console.error('Failed preview:', error);

    updateState({
      reviewItems: [],
      reviewFiles: [],
      selectedReviewFileId: null,
      selectedIntakeLineIndex: null,
      rightPanelOwner: 'inspector',
      rightPanelView: 'diagnostics',
      selectedHunkId: null,
      collapsedHunkIdsByFile: {},
      collapsedDiffGroupIdsByFile: {},
      parseErrors: [],
      parseWarnings: [],
      previewDiagnostics: [
        {
          type: 'system',
          code: 'PREVIEW_REQUEST_FAILED',
          message: 'preview request failed.',
        },
      ],
      reviewView: 'unified',
      statusMessage: 'Failed preview',
      pipelineStatus: 'parse-failure',
      isParsingInProgress: false,
      mode: 'intake',
      previewSession: null,
    });
  }
}

export function useParsingActions() {
  const { state, updateState } = useAppStateContext();

  const handleParseBlocks = () =>
    previewIntake({
      repoRoot: state.repoRoot,
      rawInput: state.aiInput,
      indexedFileSet: state.indexedFileSet,
      selectedIntakeBlockId: state.selectedIntakeBlockId,
      updateState,
    });

  return { handleParseBlocks };
}