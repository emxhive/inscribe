/**
 * Fallback parser for content without Inscribe tags
 * Looks for FILE: directives followed by fenced code blocks
 */

import {ParsedBlock, ParseResult, matchesMarker, INSCRIBE_BEGIN, DIRECTIVE_FILE} from '@inscribe/shared';
import { isFileDirective } from './parseUtils';

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
      let fenceStartIndex = -1;
      for (let j = i + 1; j < lines.length; j++) {
        const nextTrimmed = lines[j].trim();
        if (nextTrimmed.startsWith('```')) {
          fenceStartIndex = j;
          break;
        }
        // Stop if we hit another FILE: directive or an inscribe tag
        if (isFileDirective(lines[j]) || matchesMarker(lines[j], INSCRIBE_BEGIN)) {
          break;
        }
      }
      
      if (fenceStartIndex === -1) {
        continue; // No code block found for this FILE: directive
      }
      
      // Find the closing fence (must be exactly ``` to avoid matching opening fences)
      let fenceEndIndex = -1;
      for (let j = fenceStartIndex + 1; j < lines.length; j++) {
        if (lines[j].trim() === '```') {
          fenceEndIndex = j;
          break;
        }
      }
      
      if (fenceEndIndex === -1) {
        errors.push(`Block ${blockIndex}: Fenced code block not closed for file: ${file}`);
        return { blocks: [], errors };
      }
      
      // Extract content between fences
      const contentLines = lines.slice(fenceStartIndex + 1, fenceEndIndex);
      const content = contentLines.join('\n');
      
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
