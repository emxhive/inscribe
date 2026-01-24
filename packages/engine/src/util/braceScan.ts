export type BraceScanErrorType =
  | 'mismatched-closing-brace'
  | 'missing-closing-brace'
  | 'start-outside-brace-scope';

export interface BraceScanError {
  type: BraceScanErrorType;
  index: number;
}

export interface BraceMatch {
  openIndex: number;
  closeIndex: number;
}

export interface BraceScanResult {
  match?: BraceMatch;
  error?: BraceScanError;
}

export function findEnclosingBraceRange(content: string, position: number): BraceScanResult {
  if (position < 0 || position >= content.length) {
    return {
      error: {
        type: 'start-outside-brace-scope',
        index: position,
      },
    };
  }

  const stack: number[] = [];
  let targetOpen: number | null = null;
  let inLineComment = false;
  let inBlockComment = false;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inBacktick = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const next = content[i + 1];

    if (inLineComment) {
      if (char === '\n') {
        inLineComment = false;
      }
    } else if (inBlockComment) {
      if (char === '*' && next === '/') {
        inBlockComment = false;
        i += 1;
      }
    } else if (inSingleQuote) {
      if (char === '\\') {
        i += 1;
      } else if (char === '\'') {
        inSingleQuote = false;
      }
    } else if (inDoubleQuote) {
      if (char === '\\') {
        i += 1;
      } else if (char === '"') {
        inDoubleQuote = false;
      }
    } else if (inBacktick) {
      if (char === '\\') {
        i += 1;
      } else if (char === '`') {
        inBacktick = false;
      }
    } else if (char === '/' && next === '/') {
      inLineComment = true;
      i += 1;
    } else if (char === '/' && next === '*') {
      inBlockComment = true;
      i += 1;
    } else if (char === '\'') {
      inSingleQuote = true;
    } else if (char === '"') {
      inDoubleQuote = true;
    } else if (char === '`') {
      inBacktick = true;
    } else if (char === '{') {
      stack.push(i);
    } else if (char === '}') {
      if (stack.length === 0) {
        return {
          error: {
            type: 'mismatched-closing-brace',
            index: i,
          },
        };
      }
      const openIndex = stack.pop()!;
      if (openIndex === targetOpen) {
        return {
          match: {
            openIndex,
            closeIndex: i,
          },
        };
      }
    }

    if (i === position && targetOpen === null) {
      if (stack.length === 0) {
        return {
          error: {
            type: 'start-outside-brace-scope',
            index: i,
          },
        };
      }
      targetOpen = stack[stack.length - 1];
    }
  }

  if (targetOpen !== null) {
    return {
      error: {
        type: 'missing-closing-brace',
        index: targetOpen,
      },
    };
  }

  return {
    error: {
      type: 'start-outside-brace-scope',
      index: position,
    },
  };
}

export function formatBraceScanError(error: BraceScanError): string {
  switch (error.type) {
    case 'mismatched-closing-brace':
      return 'Mismatched closing brace found before matching opening brace while resolving END: "}".';
    case 'missing-closing-brace':
      return 'Missing closing brace for block containing START anchor while resolving END: "}".';
    case 'start-outside-brace-scope':
      return 'START anchor is outside any brace scope while resolving END: "}".';
    default:
      return 'Unable to resolve brace range for END: "}".';
  }
}
