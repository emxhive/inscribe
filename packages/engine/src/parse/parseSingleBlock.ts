/**
 * Functions for parsing a single Inscribe block
 */

import { ParsedBlock, Mode } from '@inscribe/shared';
import { parseDirectives } from './parseDirectives';
import { extractFencedBlock } from './parseFencedBlock';

export interface BlockParseResult {
  block?: ParsedBlock;
  error?: string;
  warnings?: string[];
}

/**
 * Parse a single block's lines
 * @param lines - Array of lines containing the block content
 * @param blockIndex - Index of the block being parsed
 * @returns Parsed block or error
 */
export function parseSingleBlock(lines: string[], blockIndex: number): BlockParseResult {
  // Parse directives
  const directiveResult = parseDirectives(lines);
  
  if (directiveResult.error) {
    return { error: directiveResult.error };
  }

  const { file, mode, directives, contentStartIndex, warnings } = directiveResult;

  // For delete mode, fenced code block is optional (no content needed)
  if (mode === 'delete') {
    return {
      block: {
        file,
        mode,
        directives,
        content: '', // Empty content for delete operations
        blockIndex,
      },
      warnings,
    };
  }

  // For all other modes, extract fenced code block content
  const fencedResult = extractFencedBlock(lines, contentStartIndex);
  
  if (fencedResult.error) {
    return { error: fencedResult.error };
  }

  if (!fencedResult.content) {
    return { error: 'No content extracted from fenced block' };
  }

  return {
    block: {
      file,
      mode,
      directives,
      content: fencedResult.content,
      blockIndex,
    },
    warnings,
  };
}
