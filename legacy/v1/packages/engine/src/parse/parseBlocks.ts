/**
 * Main parser for Inscribe blocks
 * Extracts blocks from pasted content using BEGIN/END markers
 */

import {
  ParsedBlock,
  ParseResult,
  ParseWarning,
  INSCRIBE_BEGIN,
  INSCRIBE_END,
  matchesMarker,
} from '@inscribe/shared';
import { parseSingleBlock, BlockParseResult } from './parseSingleBlock';

/**
 * Process a block parse result and add to blocks/errors/warnings arrays
 */
function processBlockResult(
  blockResult: BlockParseResult,
  blockIndex: number,
  blocks: ParsedBlock[],
  errors: string[],
  warnings: ParseWarning[]
): void {
  if (blockResult.error) {
    errors.push(`Block ${blockIndex}: ${blockResult.error}`);
  } else if (blockResult.block) {
    blocks.push(blockResult.block);
    
    if (blockResult.warnings && blockResult.warnings.length > 0) {
      blockResult.warnings.forEach(message => {
        warnings.push({ blockIndex, message });
      });
    }
  }
}

function finalizeBlock(
  blockLines: string[],
  blockIndex: number,
  blocks: ParsedBlock[],
  errors: string[],
  warnings: ParseWarning[]
): void {
  const blockResult = parseSingleBlock(blockLines, blockIndex);
  processBlockResult(blockResult, blockIndex, blocks, errors, warnings);
}

/**
 * Parse content to extract all Inscribe blocks
 * Collects all errors and warnings, continuing to process remaining blocks
 *
 * Strict behavior: only $inscribe BEGIN / $inscribe END blocks are recognized.
 * parseFallback has been removed.
 */
export function parseBlocks(content: string): ParseResult {
  const errors: string[] = [];
  const warnings: ParseWarning[] = [];
  const blocks: ParsedBlock[] = [];

  const lines = content.split('\n');
  let blockIndex = 0;
  let inBlock = false;
  let blockLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (matchesMarker(line, INSCRIBE_BEGIN)) {
      if (inBlock) {
        // Implicit END
        finalizeBlock(blockLines, blockIndex, blocks, errors, warnings);
        warnings.push({
          blockIndex,
          message: `Implicit END: BEGIN found at line ${i + 1} while already inside a block.`
        });
        blockIndex++;
      }
      
      inBlock = true;
      blockLines = [];
    } else if (matchesMarker(line, INSCRIBE_END)) {
      if (!inBlock) {
        errors.push(`Found END without matching BEGIN at line ${i + 1}`);
        continue;
      }

      finalizeBlock(blockLines, blockIndex, blocks, errors, warnings);
      inBlock = false;
      blockIndex++;
      blockLines = [];
    } else if (inBlock) {
      blockLines.push(lines[i]);
    }
  }

  if (inBlock) {
    errors.push(`Block ${blockIndex}: BEGIN without matching END (reached end of input)`);
    finalizeBlock(blockLines, blockIndex, blocks, errors, warnings);
  }

  return { blocks, errors, warnings };
}
