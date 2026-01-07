/**
 * Parser for Inscribe blocks
 * Extracts blocks from pasted content, parses directives, and extracts fenced code blocks
 */

import {
  ParsedBlock,
  ParseResult,
  INSCRIBE_BEGIN,
  INSCRIBE_END,
  INSCRIBE_FILE,
  INSCRIBE_MODE,
  INSCRIBE_START,
  INSCRIBE_END_ANCHOR,
  INSCRIBE_SCOPE_START,
  INSCRIBE_SCOPE_END,
} from '@inscribe/shared';

/**
 * Parse content to extract all Inscribe blocks
 */
export function parseBlocks(content: string): ParseResult {
  const errors: string[] = [];
  const blocks: ParsedBlock[] = [];

  const lines = content.split('\n');
  let blockIndex = 0;
  let inBlock = false;
  let blockStart = -1;
  let blockLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line === INSCRIBE_BEGIN) {
      if (inBlock) {
        errors.push(`Block ${blockIndex}: Found BEGIN while already in a block at line ${i + 1}`);
        return { blocks: [], errors };
      }
      inBlock = true;
      blockStart = i;
      blockLines = [];
    } else if (line === INSCRIBE_END) {
      if (!inBlock) {
        errors.push(`Found END without matching BEGIN at line ${i + 1}`);
        return { blocks: [], errors };
      }

      // Parse the block
      const blockResult = parseBlock(blockLines, blockIndex);
      if (blockResult.error) {
        errors.push(`Block ${blockIndex}: ${blockResult.error}`);
        return { blocks: [], errors };
      }

      if (blockResult.block) {
        blocks.push(blockResult.block);
      }

      inBlock = false;
      blockIndex++;
      blockLines = [];
    } else if (inBlock) {
      blockLines.push(lines[i]); // Keep original line with whitespace
    }
  }

  if (inBlock) {
    errors.push(`Block ${blockIndex}: BEGIN without matching END`);
    return { blocks: [], errors };
  }

  if (blocks.length === 0) {
    errors.push('No valid Inscribe blocks found');
    return { blocks: [], errors };
  }

  return { blocks, errors: [] };
}

interface BlockParseResult {
  block?: ParsedBlock;
  error?: string;
}

/**
 * Parse a single block's lines
 */
function parseBlock(lines: string[], blockIndex: number): BlockParseResult {
  const directives: Record<string, string> = {};
  let file = '';
  let mode = '';
  let contentStartIndex = -1;
  let unknownDirectiveError: string | undefined;

  // Extract directives
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    
    if (trimmed.startsWith('```')) {
      contentStartIndex = i;
      break;
    }
    
    if (trimmed.startsWith('@inscribe ')) {
      const directive = trimmed.substring('@inscribe '.length);
      if (directive.startsWith('FILE:')) {
        file = directive.substring('FILE:'.length).trim();
      } else if (directive.startsWith('MODE:')) {
        mode = directive.substring('MODE:'.length).trim();
      } else if (directive.startsWith('START:')) {
        directives.START = directive.substring('START:'.length).trim();
      } else if (directive.startsWith('END:')) {
        directives.END = directive.substring('END:'.length).trim();
      } else if (directive.startsWith('SCOPE_START:')) {
        directives.SCOPE_START = directive.substring('SCOPE_START:'.length).trim();
      } else if (directive.startsWith('SCOPE_END:')) {
        directives.SCOPE_END = directive.substring('SCOPE_END:'.length).trim();
      } else {
        unknownDirectiveError = `Unknown directive: ${directive}`;
        break;
      }
    }
  }

  if (unknownDirectiveError) {
    return { error: unknownDirectiveError };
  }

  if (!file) {
    return { error: 'Missing FILE directive' };
  }

  if (!mode) {
    mode = 'replace';
  }

  const validModes = ['create', 'replace', 'append', 'range'];
  if (!validModes.includes(mode)) {
    return { error: `Invalid MODE: ${mode}. Must be one of: ${validModes.join(', ')}` };
  }

  // Extract fenced code block content
  if (contentStartIndex === -1) {
    return { error: 'No fenced code block found' };
  }

  const fenceStart = lines[contentStartIndex].trim();
  if (!fenceStart.startsWith('```')) {
    return { error: 'Expected fenced code block (```)' };
  }

  // Find the closing fence
  let fenceEnd = -1;
  for (let i = contentStartIndex + 1; i < lines.length; i++) {
    if (lines[i].trim() === '```') {
      fenceEnd = i;
      break;
    }
  }

  if (fenceEnd === -1) {
    return { error: 'Fenced code block not closed' };
  }

  // Extract content between fences
  const content = lines.slice(contentStartIndex + 1, fenceEnd).join('\n');

  return {
    block: {
      file,
      mode: mode as any,
      directives,
      content,
      blockIndex,
    },
  };
}
