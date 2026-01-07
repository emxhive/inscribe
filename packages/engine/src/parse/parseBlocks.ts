/**
 * Main parser for Inscribe blocks
 * Extracts blocks from pasted content using BEGIN/END markers
 */

import {
  ParsedBlock,
  ParseResult,
  INSCRIBE_BEGIN,
  INSCRIBE_END,
} from '@inscribe/shared';
import { parseSingleBlock } from './parseSingleBlock';
import { parseFallbackBlocks } from './parseFallback';

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
      const blockResult = parseSingleBlock(blockLines, blockIndex);
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
    // Fallback: try to parse without inscribe tags
    return parseFallbackBlocks(content);
  }

  return { blocks, errors: [] };
}

