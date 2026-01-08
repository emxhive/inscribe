/**
 * Parsing-related handlers
 */
import type { ParseResult, ParsedBlock, ValidationError } from '@inscribe/shared';
import type { AppMode, ReviewItem } from '../types';
import { buildReviewItems } from '../utils';

type ParsingStateSetters = {
  setParseErrors: (errors: string[]) => void;
  setParsedBlocks: (blocks: ParsedBlock[]) => void;
  setValidationErrors: (errors: ValidationError[]) => void;
  setReviewItems: (items: ReviewItem[]) => void;
  setSelectedItemId: (id: string | null) => void;
  setMode: (mode: AppMode) => void;
  setStatusMessage: (message: string) => void;
};

export function createParsingHandlers(setters: ParsingStateSetters) {
  const {
    setParseErrors,
    setParsedBlocks,
    setValidationErrors,
    setReviewItems,
    setSelectedItemId,
    setMode,
    setStatusMessage,
  } = setters;

  const handleParseBlocks = async (repoRoot: string | null, aiInput: string) => {
    if (!repoRoot) {
      setStatusMessage('Error: No repository selected');
      setParseErrors(['No repository selected. Please select a repository first.']);
      return;
    }

    if (!aiInput.trim()) {
      setStatusMessage('Error: No input provided');
      setParseErrors(['No input provided. Please paste AI response.']);
      return;
    }

    try {
      setStatusMessage('Parsing code blocks...');
      const parseResult: ParseResult = await window.inscribeAPI.parseBlocks(aiInput);
      
      if (parseResult.errors && parseResult.errors.length > 0) {
        setParseErrors(parseResult.errors);
        setStatusMessage(`Parse failed: ${parseResult.errors.length} error(s)`);
        return;
      }

      setParseErrors([]);
      setParsedBlocks(parseResult.blocks || []);

      // Validate blocks
      setStatusMessage('Validating blocks...');
      const validationErrors = await window.inscribeAPI.validateBlocks(
        parseResult.blocks || [],
        repoRoot
      );
      
      setValidationErrors(validationErrors || []);

      // Build review items
      const reviewItems = buildReviewItems(parseResult.blocks || [], validationErrors || []);
      setReviewItems(reviewItems);

      // Select first item
      if (reviewItems.length > 0) {
        setSelectedItemId(reviewItems[0].id);
      }

      // Navigate to review
      setMode('review');
      const errorCount = validationErrors?.length || 0;
      if (errorCount > 0) {
        setStatusMessage(`Ready to review: ${reviewItems.length} files, ${errorCount} validation error(s)`);
      } else {
        setStatusMessage(`Ready to review: ${reviewItems.length} files`);
      }
    } catch (error) {
      console.error('Failed to parse blocks:', error);
      setParseErrors([String(error)]);
      setStatusMessage('Failed to parse blocks');
    }
  };

  return {
    handleParseBlocks,
  };
}
