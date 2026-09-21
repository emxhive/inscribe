import {
  findDiagnosticBlock,
  parseLiveIntakeStructure,
} from '@/utils';
import type { PreviewErrorDTO } from '@/ipc/previewTypes';
import { adaptPreview } from '@/utils/reviewAdapter';
import {
  buildPreviewFailureUpdate,
  buildPreviewNoChangesUpdate,
  buildPreviewReadyUpdate,
  buildPreviewRequestFailureUpdate,
  buildPreviewStartedUpdate,
  type PreviewDiagnosticTarget,
} from '@/state/previewTransitions';
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
): PreviewDiagnosticTarget {
  const structure = parseLiveIntakeStructure(input, {
    indexedFileSet,
  });

  for (const diagnostic of diagnostics) {
    const block = findDiagnosticBlock(
      structure.blocks,
      diagnostic,
    );

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
      parseErrors: [
        'No repository selected. Please select a repository first.',
      ],
      pipelineStatus: 'idle',
    });
    return;
  }

  if (!rawInput.trim()) {
    updateState({
      statusMessage: 'Error: No input provided',
      parseErrors: [
        'No input provided. Please paste AI response.',
      ],
      pipelineStatus: 'idle',
    });
    return;
  }

  try {
    updateState(
      buildPreviewStartedUpdate(startStatusMessage),
    );

    const response =
      await window.inscribeAPI.preview({
        repoRoot,
        rawInput,
      });

    const diagnosticTarget =
      getFirstDiagnosticTarget(
        rawInput,
        indexedFileSet,
        response.errors,
      );

    if (!response.ok) {
      updateState(
        buildPreviewFailureUpdate(
          response.errors,
          diagnosticTarget,
        ),
      );
      return;
    }

    const adapted = adaptPreview(
      response.executions,
      response.finalFiles,
    );

    const excludedBlockCount = new Set(
      response.errors
        .filter(
          (error) =>
            typeof error.blockIndex === 'number',
        )
        .map((error) => error.blockIndex),
    ).size;

    if (adapted.reviewFiles.length === 0) {
      updateState(
        buildPreviewNoChangesUpdate(
          response.errors,
          diagnosticTarget,
          excludedBlockCount,
        ),
      );
      return;
    }

    updateState(
      buildPreviewReadyUpdate({
        reviewItems: adapted.reviewItems,
        reviewFiles: adapted.reviewFiles,
        diagnostics: response.errors,
        diagnosticTarget,
        selectedIntakeBlockId,
        partial: response.partial,
        excludedBlockCount,
        previewToken: response.previewToken,
        expiresAt: response.expiresAt,
      }),
    );
  } catch (error) {
    console.error('Failed preview:', error);

    updateState(
      buildPreviewRequestFailureUpdate(),
    );
  }
}

export function useParsingActions() {
  const { state, updateState } =
    useAppStateContext();

  const handleParseBlocks = () =>
    previewIntake({
      repoRoot: state.repoRoot,
      rawInput: state.aiInput,
      indexedFileSet: state.indexedFileSet,
      selectedIntakeBlockId:
        state.selectedIntakeBlockId,
      updateState,
    });

  return { handleParseBlocks };
}