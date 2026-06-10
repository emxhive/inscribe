/**
 * Functions for extracting fenced code blocks
 */

export interface FencedBlockResult {
  content?: string;
  error?: string;
  endIndex?: number;
}

interface Fence {
  char: '`' | '~';
  length: number;
}

export interface ExtractFencedBlockOptions {
  /**
   * Explicit Inscribe blocks should contain only one payload fence. If text
   * remains after the closing fence, the parser probably closed too early.
   */
  requireTrailingWhitespace?: boolean;
}

function parseOpeningFence(line: string): Fence | null {
  const trimmed = line.trim();
  const match = trimmed.match(/^(`{3,}|~{3,})/);
  if (!match) return null;

  const marker = match[1];
  return {
    char: marker[0] as '`' | '~',
    length: marker.length,
  };
}

function isClosingFence(line: string, openingFence: Fence): boolean {
  const trimmed = line.trim();
  const pattern = openingFence.char === '`' ? /^(`{3,})(\s*)$/ : /^(~{3,})(\s*)$/;
  const match = trimmed.match(pattern);

  return Boolean(match && match[1].length >= openingFence.length);
}

export function isFenceOpeningLine(line: string): boolean {
  return parseOpeningFence(line) !== null;
}

/**
 * Extract content from a fenced code block within the given lines
 * @param lines - Array of lines to search for fenced code block
 * @param startIndex - Index to start searching from
 * @returns Object with content or error
 */
export function extractFencedBlock(
  lines: string[],
  startIndex: number,
  options: ExtractFencedBlockOptions = {}
): FencedBlockResult {
  if (startIndex === -1) {
    return { error: 'No fenced code block found' };
  }

  const openingFence = parseOpeningFence(lines[startIndex]);
  if (!openingFence) {
    return { error: 'Expected fenced code block (``` or ~~~)' };
  }

  // Find the closing fence
  let fenceEnd = -1;
  for (let i = startIndex + 1; i < lines.length; i++) {
    if (isClosingFence(lines[i], openingFence)) {
      fenceEnd = i;
      break;
    }
  }

  if (fenceEnd === -1) {
    return { error: 'Fenced code block not closed' };
  }

  // Extract content between fences
  const content = lines.slice(startIndex + 1, fenceEnd).join('\n');

  if (options.requireTrailingWhitespace) {
    const trailingContentLine = lines
      .slice(fenceEnd + 1)
      .find(line => line.trim().length > 0);

    if (trailingContentLine) {
      return {
        error: `Unexpected content after fenced code block: ${trailingContentLine.trim()}`,
      };
    }
  }

  return { content, endIndex: fenceEnd };
}

/**
 * Find the index of the next fenced code block in the lines
 * @param lines - Array of lines to search
 * @param startIndex - Index to start searching from
 * @returns Index of the opening fence, or -1 if not found
 */
export function findFencedBlockStart(lines: string[], startIndex: number): number {
  for (let i = startIndex; i < lines.length; i++) {
    if (isFenceOpeningLine(lines[i])) {
      return i;
    }
  }
  return -1;
}
