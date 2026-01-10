/**
 * Fallback parser for content without Inscribe tags
 * Looks for FILE: directives followed by fenced code blocks
 */

import { ParsedBlock, ParseResult, matchesMarker, INSCRIBE_BEGIN, DIRECTIVE_FILE } from '@inscribe/shared';
import { isFileDirective } from './parseUtils';
import { extractFencedBlock } from './parseFencedBlock';

function findFenceStartBeforeStop(lines: string[], startIndex: number): number {
  for (let j = startIndex; j < lines.length; j++) {
    if (isFileDirective(lines[j]) || matchesMarker(lines[j], INSCRIBE_BEGIN)) {
      return -1;
    }
    if (lines[j].trim().startsWith('```')) {
      return j;
    }
  }
  return -1;
}

/**
 * Parse content without inscribe tags (fallback mode)
 * Looks for FILE: directives followed by fenced code blocks
 */
export function parseFallbackBlocks(content: string): ParseResult {
  const errors: string[] = [];
  const blocks: ParsedBlock[] = [];
  const lines = content.split('\n');
  
  let blockIndex = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    
    // Look for FILE: directive (matches case-insensitively by converting to uppercase)
    if (isFileDirective(lines[i])) {
      const file = trimmed.substring(DIRECTIVE_FILE.length).trim();
      
      if (!file) {
        continue; // Skip empty FILE: directives
      }
      
      // Look for the next fenced code block
      const fenceStartIndex = findFenceStartBeforeStop(lines, i + 1);

      if (fenceStartIndex === -1) {
        continue; // No code block found for this FILE: directive
      }

      const fencedResult = extractFencedBlock(lines, fenceStartIndex);
      if (fencedResult.error) {
        errors.push(`Block ${blockIndex}: ${fencedResult.error} for file: ${file}`);
        return { blocks: [], errors };
      }

      const fenceEndIndex = fencedResult.endIndex ?? fenceStartIndex;
      const content = fencedResult.content ?? '';
      
      blocks.push({
        file,
        mode: 'replace', // Default to replace mode
        directives: {},
        content,
        blockIndex,
      });
      
      blockIndex++;
      i = fenceEndIndex; // Skip past this block
    }
  }
  
  if (blocks.length === 0) {
    errors.push('No valid Inscribe blocks found');
    return { blocks: [], errors };
  }
  
  return { blocks, errors: [] };
}
