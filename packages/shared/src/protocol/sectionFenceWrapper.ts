export interface SectionLineInput {
  text: string;
  lineNum: number;
}

export type SectionWrapperResult =
  | { type: 'unwrapped'; bodyStartIdx: number; bodyEndIdx: number }
  | { type: 'literal' }
  | { type: 'error'; lineNum: number; message: string };

/**
 * Parses a section to detect and validate Markdown code fence wrappers.
 *
 * Requirements:
 * - Fence openers must start with 0-3 leading spaces followed by at least 3 backticks or tildes.
 * - The closing fence must use the same character (backtick or tilde) and have at least the length of the opener.
 * - If the section starts with a fence opener, it must have a valid closing fence at the end. Any malformed
 *   state (missing closer, incorrect char/length, or trailing text) returns an error.
 * - If the section does not start with a fence opener, it is treated as a literal payload.
 */
export function parseSectionFenceWrapper(lines: SectionLineInput[]): SectionWrapperResult {
  // 1. Find the first non-blank line
  let firstNonBlankIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].text.trim() !== '') {
      firstNonBlankIdx = i;
      break;
    }
  }

  if (firstNonBlankIdx === -1) {
    return { type: 'literal' };
  }

  // 2. Check if the first non-blank line matches the opening fence pattern
  const firstLine = lines[firstNonBlankIdx];
  const matchOpener = firstLine.text.match(/^( {0,3})(\`{3,}|~{3,})([^\`~]*)$/);
  if (!matchOpener) {
    return { type: 'literal' };
  }

  const openerChar = matchOpener[2][0];
  const openerLength = matchOpener[2].length;

  // 3. Find the last non-blank line
  let lastNonBlankIdx = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].text.trim() !== '') {
      lastNonBlankIdx = i;
      break;
    }
  }

  // 4. Validate matching closer
  if (lastNonBlankIdx === firstNonBlankIdx) {
    return {
      type: 'error',
      lineNum: firstLine.lineNum,
      message: 'missing closing fence',
    };
  }

  const lastLine = lines[lastNonBlankIdx];
  const matchCloser = lastLine.text.match(/^( {0,3})(\`{3,}|~{3,})\s*$/);
  if (!matchCloser) {
    return {
      type: 'error',
      lineNum: firstLine.lineNum,
      message: 'missing closing fence or trailing text after closer',
    };
  }

  const closerChar = matchCloser[2][0];
  const closerLength = matchCloser[2].length;

  if (closerChar !== openerChar) {
    return {
      type: 'error',
      lineNum: firstLine.lineNum,
      message: 'closing fence uses the wrong character',
    };
  }

  if (closerLength < openerLength) {
    return {
      type: 'error',
      lineNum: firstLine.lineNum,
      message: 'closing fence is shorter than the opener',
    };
  }

  // Success
  return {
    type: 'unwrapped',
    bodyStartIdx: firstNonBlankIdx + 1,
    bodyEndIdx: lastNonBlankIdx - 1,
  };
}
