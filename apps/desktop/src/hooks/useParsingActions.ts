import type { ParseResult } from '@inscribe/shared';
import {
  buildReviewItems,
  findV2DiagnosticBlock,
  parseLiveIntakeStructure,
  prepareInscribeInput,
} from '@/utils';
import type { PreviewV2ErrorDTO } from '@/ipc/previewV2Types';
import { adaptV2Executions } from '@/utils/v2ReviewAdapter';
import { useAppStateContext } from './useAppStateContext';

function getFirstDiagnosticTarget(
  input: string,
  indexedFileSet: Set<string>,
  diagnostics: PreviewV2ErrorDTO[],
): { blockId: string; lineIndex: number | null } | null {
  const structure = parseLiveIntakeStructure(input, { indexedFileSet });
  for (const diagnostic of diagnostics) {
    const block = findV2DiagnosticBlock(structure.blocks, diagnostic);
    if (block) {
      return {
        blockId: block.id,
        lineIndex: typeof diagnostic.line === 'number' ? Math.max(0, diagnostic.line - 1) : block.startLine,
      };
    }
  }
  return null;
}

/**
 * Hook for parsing-related operations
 */
export function useParsingActions() {
  const { state, updateState } = useAppStateContext();

  const confirmPreviouslyAppliedInput = async (input: string): Promise<boolean> => {
    if (!state.repoRoot || !input.trim()) {
      return true;
    }

    try {
      const existing = await window.inscribeAPI.getAppliedAiInput(input, state.repoRoot);
      if (!existing) {
        return true;
      }

      const shouldContinue = await window.inscribeAPI.confirmPreviouslyAppliedAiInputParse(existing);
      if (!shouldContinue) {
        updateState({
          pipelineStatus: 'idle',
          statusMessage: 'Parse canceled: this AI input was already applied.',
        });
      }
      return shouldContinue;
    } catch (error) {
      console.error('Failed to check applied AI input:', error);
      updateState({
        pipelineStatus: 'idle',
        statusMessage: 'Unable to check whether this AI input was already applied.',
      });
      return false;
    }
  };

  const handleParseBlocks = async () => {
    if (!state.repoRoot) {
      updateState({
        statusMessage: 'Error: No repository selected',
        parseErrors: ['No repository selected. Please select a repository first.'],
        pipelineStatus: 'idle'
      });
      return;
    }

    if (!state.aiInput.trim()) {
      updateState({
        statusMessage: 'Error: No input provided',
        parseErrors: ['No input provided. Please paste AI response.'],
        pipelineStatus: 'idle'
      });
      return;
    }

    const rawInput = state.aiInput;
    const prepared = prepareInscribeInput(rawInput);

    if (prepared.protocol === 'v2') {
      try {
        updateState({
          isParsingInProgress: true,
          pipelineStatus: 'parsing',
          reviewComparisonError: null,
          reviewPreflightByItem: {},
          v2PreviewDiagnostics: [],
          statusMessage: 'Previewing V2 changes...',
        });

        const response = await window.inscribeAPI.previewV2({
          repoRoot: state.repoRoot,
          rawInput: prepared.parseInput,
        });

        if (!response.ok) {
          const firstDiagnosticTarget = getFirstDiagnosticTarget(
            prepared.parseInput,
            state.indexedFileSet,
            response.errors,
          );
          updateState({
            parsedBlocks: [],
            validationErrors: [],
            reviewItems: [],
            reviewComparisonByItem: {},
            reviewPreflightByItem: {},
            selectedItemId: null,
            selectedHunkId: null,
            collapsedHunkIdsByItem: {},
            collapsedDiffGroupIdsByItem: {},
            parseErrors: [],
            parseWarnings: [],
            v2PreviewDiagnostics: response.errors,
            selectedIntakeBlockId: firstDiagnosticTarget?.blockId ?? null,
            selectedIntakeLineIndex: firstDiagnosticTarget?.lineIndex ?? null,
            rightPanelOwner: 'inspector',
            rightPanelView: 'diagnostics',
            reviewComparisonError: null,
            isEditing: false,
            reviewView: 'unified',
            statusMessage: `Preview V2 failed: ${response.errors.length} error(s)`,
            pipelineStatus: 'parse-failure',
            isParsingInProgress: false,
            mode: 'intake',
            v2PreviewSession: null,
          });
          return;
        }

        const adapted = adaptV2Executions(response.executions);

        const firstFaultyTarget = getFirstDiagnosticTarget(
          prepared.parseInput,
          state.indexedFileSet,
          response.errors,
        );
        const excludedBlockCount = new Set(
          response.errors
            .filter((error) => typeof error.blockIndex === 'number')
            .map((error) => error.blockIndex),
        ).size;

        updateState({
          parsedBlocks: [],
          validationErrors: [],
          reviewItems: adapted.reviewItems,
          reviewComparisonByItem: adapted.reviewComparisonByItem,
          reviewPreflightByItem: adapted.reviewPreflightByItem,
          parseErrors: [],
          parseWarnings: [],
          v2PreviewDiagnostics: response.errors,
          selectedItemId: adapted.reviewItems.length > 0 ? adapted.reviewItems[0].id : null,
          selectedIntakeBlockId: response.partial ? firstFaultyTarget?.blockId ?? null : state.selectedIntakeBlockId,
          selectedIntakeLineIndex: response.partial ? firstFaultyTarget?.lineIndex ?? null : null,
          rightPanelOwner: 'inspector',
          rightPanelView: response.partial ? 'diagnostics' : 'properties',
          selectedHunkId: null,
          collapsedHunkIdsByItem: {},
          collapsedDiffGroupIdsByItem: {},
          isEditing: false,
          reviewView: 'unified',
          reviewComparisonError: null,
          mode: response.partial ? 'intake' : 'review',
          pipelineStatus: response.partial ? 'parse-partial' : 'parse-success',
          isParsingInProgress: false,
          statusMessage: response.partial
            ? `Previewed ${adapted.reviewItems.length} valid V2 operation${adapted.reviewItems.length === 1 ? '' : 's'}; ${excludedBlockCount || response.errors.length} block${(excludedBlockCount || response.errors.length) === 1 ? '' : 's'} excluded.`
            : `Ready to review: ${adapted.reviewItems.length} V2 operations`,
          v2PreviewSession: {
            previewToken: response.previewToken,
            expiresAt: response.expiresAt,
          },
        });
      } catch (error) {
        console.error('Failed V2 preview:', error);
        updateState({
          parsedBlocks: [],
          validationErrors: [],
          reviewItems: [],
          reviewComparisonByItem: {},
          reviewPreflightByItem: {},
          selectedItemId: null,
          selectedIntakeLineIndex: null,
          rightPanelOwner: 'inspector',
          rightPanelView: 'diagnostics',
          selectedHunkId: null,
          collapsedHunkIdsByItem: {},
          collapsedDiffGroupIdsByItem: {},
          parseErrors: [],
          parseWarnings: [],
          v2PreviewDiagnostics: [{
            type: 'system',
            code: 'PREVIEW_REQUEST_FAILED',
            message: 'V2 preview request failed.',
          }],
          reviewComparisonError: null,
          isEditing: false,
          reviewView: 'unified',
          statusMessage: 'Failed V2 preview',
          pipelineStatus: 'parse-failure',
          isParsingInProgress: false,
          mode: 'intake',
          v2PreviewSession: null,
        });
      }
      return;
    }

    const parseInput = prepared.parseInput;
    const normalization = prepared.normalization!;

    updateState({ v2PreviewSession: null, v2PreviewDiagnostics: [] });

    if (!(await confirmPreviouslyAppliedInput(parseInput))) {
      return;
    }

    try {
      updateState({
        isParsingInProgress: true,
        pipelineStatus: 'parsing',
        reviewComparisonError: null,
        reviewPreflightByItem: {},
        statusMessage: 'Parsing code blocks...'
      });

      const parseResult: ParseResult = await window.inscribeAPI.parseBlocks(parseInput);
      const normalizationWarnings = normalization.repairs.map((repair) => ({ message: repair.message }));
      const parseWarnings = [...normalizationWarnings, ...(parseResult.warnings || [])];
      
      if (parseResult.errors && parseResult.errors.length > 0) {
        updateState({
          ...(normalization.changed ? { aiInput: parseInput } : {}),
          parseErrors: parseResult.errors,
          parseWarnings,
          statusMessage: `Parse failed: ${parseResult.errors.length} error(s)`,
          pipelineStatus: 'parse-failure',
          isParsingInProgress: false
        });
        return;
      }

      updateState({
        ...(normalization.changed ? { aiInput: parseInput } : {}),
        parseErrors: [],
        parseWarnings,
        parsedBlocks: parseResult.blocks || [],
        statusMessage: 'Validating blocks...'
      });

      // Validate blocks
      const validationErrors = await window.inscribeAPI.validateBlocks(
        parseResult.blocks || []
      );

      // Build review items
      const reviewItems = buildReviewItems(parseResult.blocks || [], validationErrors || []);

      const errorCount = validationErrors?.length || 0;
      updateState({
        validationErrors: validationErrors || [],
        reviewItems,
        selectedItemId: reviewItems.length > 0 ? reviewItems[0].id : null,
        mode: 'review',
        pipelineStatus: 'parse-success',
        isParsingInProgress: false,
        statusMessage: errorCount > 0 
          ? `Ready to review: ${reviewItems.length} files, ${errorCount} validation error(s)`
          : `Ready to review: ${reviewItems.length} files`
      });
    } catch (error) {
      console.error('Failed to parse blocks:', error);
      updateState({
        parseErrors: [String(error)],
        statusMessage: 'Failed to parse blocks',
        pipelineStatus: 'parse-failure',
        isParsingInProgress: false
      });
    }
  };

  return {
    handleParseBlocks,
  };
}
