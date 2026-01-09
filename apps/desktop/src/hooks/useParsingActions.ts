import type { ParseResult } from '@inscribe/shared';
import { buildReviewItems } from '../utils';
import { useAppStateContext } from './useAppStateContext';

/**
 * Hook for parsing-related operations
 */
export function useParsingActions() {
  const { state, updateState } = useAppStateContext();
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

    try {
      updateState({
        isParsingInProgress: true,
        pipelineStatus: 'parsing',
        statusMessage: 'Parsing code blocks...'
      });

      const parseResult: ParseResult = await window.inscribeAPI.parseBlocks(state.aiInput);
      
      if (parseResult.errors && parseResult.errors.length > 0) {
        updateState({
          parseErrors: parseResult.errors,
          statusMessage: `Parse failed: ${parseResult.errors.length} error(s)`,
          pipelineStatus: 'parse-failure',
          isParsingInProgress: false
        });
        return;
      }

      updateState({
        parseErrors: [],
        parsedBlocks: parseResult.blocks || [],
        statusMessage: 'Validating blocks...'
      });

      // Validate blocks
      const validationErrors = await window.inscribeAPI.validateBlocks(
        parseResult.blocks || [],
        state.repoRoot
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
