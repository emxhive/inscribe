/**
 * Functions for extracting fenced code blocks
 */

export interface FencedBlockResult {
  content?: string;
  error?: string;
}

/**
 * Extract content from a fenced code block within the given lines
 * @param lines - Array of lines to search for fenced code block
 * @param startIndex - Index to start searching from
 * @returns Object with content or error
 */
export function extractFencedBlock(lines: string[], startIndex: number): FencedBlockResult {
  if (startIndex === -1) {
    return { error: 'No fenced code block found' };
  }

  const fenceStart = lines[startIndex].trim();
  if (!fenceStart.startsWith('```')) {
    return { error: 'Expected fenced code block (```)' };
  }

  // Find the closing fence
  let fenceEnd = -1;
  for (let i = startIndex + 1; i < lines.length; i++) {
    if (lines[i].trim() === '```') {
      fenceEnd = i;
      break;
    }
  }

  if (fenceEnd === -1) {
    return { error: 'Fenced code block not closed' };
  }

  // Extract content between fences
  const content = lines.slice(startIndex + 1, fenceEnd).join('\n');

  return { content };
}

/**
 * Find the index of the next fenced code block in the lines
 * @param lines - Array of lines to search
 * @param startIndex - Index to start searching from
 * @returns Index of the opening fence, or -1 if not found
 */
export function findFencedBlockStart(lines: string[], startIndex: number): number {
  for (let i = startIndex; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith('```')) {
      return i;
    }
  }
  return -1;
}
