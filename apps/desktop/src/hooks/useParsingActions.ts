import type { ParseResult } from '@inscribe/shared';
import { buildReviewItems, prepareInscribeInput } from '@/utils';
import { adaptV2Executions } from '@/utils/v2ReviewAdapter';
import { useAppStateContext } from './useAppStateContext';

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
          statusMessage: 'Previewing V2 changes...',
        });

        const response = await window.inscribeAPI.previewV2({
          repoRoot: state.repoRoot,
          rawInput: prepared.parseInput,
        });

        if (!response.ok) {
          const errors = response.errors.map((err) => {
            if (err.type === 'protocol') {
              return `Protocol Error [${err.code}]: ${err.message} (Block ${err.blockIndex ?? 'unknown'}, Line ${err.line ?? 'unknown'})${err.context ? ` - Context: ${err.context}` : ''}`;
            } else if (err.type === 'workspace' || err.type === 'resolution') {
              return `Workspace/Resolution Error [${err.code}] in file ${err.filePath ?? 'unknown'} (Strategy: ${err.strategy ?? 'unknown'}, Operation: ${err.operationIndex ?? 'unknown'}): ${err.message}`;
            } else {
              return `System Error [${err.code}]: ${err.message}`;
            }
          });

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
            parseErrors: errors,
            parseWarnings: [],
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

        updateState({
          parsedBlocks: [],
          validationErrors: [],
          reviewItems: adapted.reviewItems,
          reviewComparisonByItem: adapted.reviewComparisonByItem,
          reviewPreflightByItem: adapted.reviewPreflightByItem,
          parseErrors: [],
          parseWarnings: [],
          selectedItemId: adapted.reviewItems.length > 0 ? adapted.reviewItems[0].id : null,
          selectedHunkId: null,
          collapsedHunkIdsByItem: {},
          collapsedDiffGroupIdsByItem: {},
          isEditing: false,
          reviewView: 'unified',
          reviewComparisonError: null,
          mode: 'review',
          pipelineStatus: 'parse-success',
          isParsingInProgress: false,
          statusMessage: `Ready to review: ${adapted.reviewItems.length} V2 operations`,
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
          selectedHunkId: null,
          collapsedHunkIdsByItem: {},
          collapsedDiffGroupIdsByItem: {},
          parseErrors: ['V2 preview request failed.'],
          parseWarnings: [],
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

    updateState({ v2PreviewSession: null });

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
