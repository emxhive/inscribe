/**
 * Functions for parsing a single Inscribe block
 */

import { ParsedBlock } from '@inscribe/shared';
import { parseDirectives } from './parseDirectives';
import { extractFencedBlock } from './parseFencedBlock';

export interface BlockParseResult {
  block?: ParsedBlock;
  error?: string;
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

  const { file, mode, directives, contentStartIndex } = directiveResult;

  // Extract fenced code block content
  const fencedResult = extractFencedBlock(lines, contentStartIndex);
  
  if (fencedResult.error) {
    return { error: fencedResult.error };
  }

  return {
    block: {
      file,
      mode: mode as any,
      directives,
      content: fencedResult.content!,
      blockIndex,
    },
  };
}
