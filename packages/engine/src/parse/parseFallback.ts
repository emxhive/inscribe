/**
 * Fallback parser for content without Inscribe tags
 * Looks for FILE/MODE headers followed by fenced code blocks
 */

import {
  ParsedBlock,
  ParseResult,
  matchesMarker,
  INSCRIBE_BEGIN,
  HEADER_FILE,
  HEADER_MODE,
  extractMarkerValue,
  startsWithMarker,
  isValidMode,
} from '@inscribe/shared';
import { isFileHeader } from './parseUtils';
import { extractFencedBlock } from './parseFencedBlock';

function findFenceStartBeforeStop(lines: string[], startIndex: number): number {
  for (let j = startIndex; j < lines.length; j++) {
    if (isFileHeader(lines[j]) || matchesMarker(lines[j], INSCRIBE_BEGIN)) {
      return -1;
    }
    if (lines[j].trim().startsWith('```')) {
      return j;
    }
  }
  return -1;
}

function findModeHeader(lines: string[], startIndex: number, stopIndex: number): string | null {
  for (let j = startIndex; j < stopIndex; j++) {
    if (startsWithMarker(lines[j].trim(), HEADER_MODE)) {
      return extractMarkerValue(lines[j].trim(), HEADER_MODE);
    }
  }
  return null;
}

/**
 * Parse content without inscribe tags (fallback mode)
 * Looks for FILE/MODE headers followed by fenced code blocks
 */
export function parseFallbackBlocks(content: string): ParseResult {
  const errors: string[] = [];
  const blocks: ParsedBlock[] = [];
  const lines = content.split('\n');
  
  let blockIndex = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    
    // Look for FILE: header (matches case-insensitively by converting to uppercase)
    if (isFileHeader(lines[i])) {
      const file = trimmed.substring(HEADER_FILE.length).trim();
      
      if (!file) {
        continue; // Skip empty FILE: headers
      }
      
      // Look for the next fenced code block
      const fenceStartIndex = findFenceStartBeforeStop(lines, i + 1);

      if (fenceStartIndex === -1) {
        continue; // No code block found for this FILE: header
      }

      const mode = findModeHeader(lines, i + 1, fenceStartIndex);
      if (!mode) {
        errors.push(`Block ${blockIndex}: Missing MODE header for file: ${file}`);
        continue;
      }
      if (!isValidMode(mode)) {
        errors.push(`Block ${blockIndex}: Invalid MODE header: ${mode} for file: ${file}`);
        continue;
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
        mode,
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
