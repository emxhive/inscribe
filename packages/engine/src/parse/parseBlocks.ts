/**
 * Main parser for Inscribe blocks
 * Extracts blocks from pasted content using BEGIN/END markers
 */

import {
  ParsedBlock,
  ParseResult,
  INSCRIBE_BEGIN,
  INSCRIBE_END,
  matchesMarker,
} from '@inscribe/shared';
import { parseSingleBlock, BlockParseResult } from './parseSingleBlock';
import { parseFallbackBlocks } from './parseFallback';

/**
 * Process a block parse result and add to blocks/errors arrays
 */
function processBlockResult(
  blockResult: BlockParseResult,
  blockIndex: number,
  blocks: ParsedBlock[],
  errors: string[]
): void {
  if (blockResult.error) {
    errors.push(`Block ${blockIndex}: ${blockResult.error}`);
  } else if (blockResult.block) {
    blocks.push(blockResult.block);
    
    // Add warnings if any
    if (blockResult.warnings && blockResult.warnings.length > 0) {
      blockResult.warnings.forEach(warning => {
        errors.push(`Block ${blockIndex} warning: ${warning}`);
      });
    }
  }
}

/**
 * Parse content to extract all Inscribe blocks
 * Collects all errors and warnings, continuing to process remaining blocks
 */
export function parseBlocks(content: string): ParseResult {
  const errors: string[] = [];
  const blocks: ParsedBlock[] = [];

  const lines = content.split('\n');
  let blockIndex = 0;
  let inBlock = false;
  let blockLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (matchesMarker(line, INSCRIBE_BEGIN)) {
      if (inBlock) {
        // BEGIN inside BEGIN: This handles nested BEGIN markers
        // When a BEGIN is found while already in a block, treat the second BEGIN
        // as an implicit END for the current block, then start a new block.
        // This is the fallback behavior to handle user error gracefully.
        
        // Try to parse the previous block
        const blockResult = parseSingleBlock(blockLines, blockIndex);
        processBlockResult(blockResult, blockIndex, blocks, errors);
        
        // Add a warning about the implicit END
        errors.push(`Block ${blockIndex}: BEGIN found without END at line ${i + 1}. Treating this BEGIN as implicit END and start of new block.`);
        
        blockIndex++;
      }
      
      inBlock = true;
      blockLines = [];
    } else if (matchesMarker(line, INSCRIBE_END)) {
      if (!inBlock) {
        // END without BEGIN - collect error but continue processing
        errors.push(`Found END without matching BEGIN at line ${i + 1}`);
        continue;
      }

      // Parse the block
      const blockResult = parseSingleBlock(blockLines, blockIndex);
      processBlockResult(blockResult, blockIndex, blocks, errors);

      inBlock = false;
      blockIndex++;
      blockLines = [];
    } else if (inBlock) {
      blockLines.push(lines[i]); // Keep original line with whitespace
    }
  }

  if (inBlock) {
    // Handle unclosed block at end of content
    errors.push(`Block ${blockIndex}: BEGIN without matching END`);
    
    // Try to parse it anyway as a best effort
    const blockResult = parseSingleBlock(blockLines, blockIndex);
    processBlockResult(blockResult, blockIndex, blocks, errors);
  }

  if (blocks.length === 0 && errors.length === 0) {
    // No blocks found with inscribe tags - try fallback mode
    return parseFallbackBlocks(content);
  }

  // Return both successfully parsed blocks and accumulated errors
  return { blocks, errors };
}

