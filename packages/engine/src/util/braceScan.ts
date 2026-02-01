export type BraceScanErrorType =
  | 'mismatched-closing-brace'
  | 'missing-closing-brace'
  | 'missing-opening-brace-in-range';

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

export function resolveBraceSelectionStart(
  anchorStart: number,
  anchorEnd: number,
  startDirectiveKey: string
): number {
  switch (startDirectiveKey) {
    case 'START':
      return anchorStart;
    case 'START_AFTER':
      return anchorEnd;
    case 'START_BEFORE':
      return Math.max(0, anchorStart - 1);
    default:
      return anchorStart;
  }
}

interface BraceScanState {
  inLineComment: boolean;
  inBlockComment: boolean;
  inSingleQuote: boolean;
  inDoubleQuote: boolean;
  inBacktick: boolean;
}

function createBraceScanState(): BraceScanState {
  return {
    inLineComment: false,
    inBlockComment: false,
    inSingleQuote: false,
    inDoubleQuote: false,
    inBacktick: false,
  };
}

function advanceBraceScanState(
  content: string,
  index: number,
  state: BraceScanState
): { index: number; canScanBraces: boolean } {
  const char = content[index];
  const next = content[index + 1];

  if (state.inLineComment) {
    if (char === '\n') {
      state.inLineComment = false;
    }
    return { index, canScanBraces: false };
  }

  if (state.inBlockComment) {
    if (char === '*' && next === '/') {
      state.inBlockComment = false;
      return { index: index + 1, canScanBraces: false };
    }
    return { index, canScanBraces: false };
  }

  if (state.inSingleQuote) {
    if (char === '\\') {
      return { index: index + 1, canScanBraces: false };
    }
    if (char === '\'') {
      state.inSingleQuote = false;
    }
    return { index, canScanBraces: false };
  }

  if (state.inDoubleQuote) {
    if (char === '\\') {
      return { index: index + 1, canScanBraces: false };
    }
    if (char === '"') {
      state.inDoubleQuote = false;
    }
    return { index, canScanBraces: false };
  }

  if (state.inBacktick) {
    if (char === '\\') {
      return { index: index + 1, canScanBraces: false };
    }
    if (char === '`') {
      state.inBacktick = false;
    }
    return { index, canScanBraces: false };
  }

  if (char === '/' && next === '/') {
    state.inLineComment = true;
    return { index: index + 1, canScanBraces: false };
  }

  if (char === '/' && next === '*') {
    state.inBlockComment = true;
    return { index: index + 1, canScanBraces: false };
  }

  if (char === '\'') {
    state.inSingleQuote = true;
    return { index, canScanBraces: false };
  }

  if (char === '"') {
    state.inDoubleQuote = true;
    return { index, canScanBraces: false };
  }

  if (char === '`') {
    state.inBacktick = true;
    return { index, canScanBraces: false };
  }

  return { index, canScanBraces: true };
}

export function findBraceRangeFromSelection(
  content: string,
  rangeStart: number,
  rangeEnd: number = content.length
): BraceScanResult {
  // Scan forward from the START-selected range to find the first "{", then return
  // the matching "}" while ignoring braces in comments and strings.
  const normalizedEnd = Math.min(Math.max(0, rangeEnd), content.length);
  const normalizedStart = Math.min(Math.max(0, rangeStart), normalizedEnd);

  if (normalizedStart >= normalizedEnd) {
    return {
      error: {
        type: 'missing-opening-brace-in-range',
        index: normalizedStart,
      },
    };
  }

  const state = createBraceScanState();

  for (let i = 0; i < normalizedStart; i++) {
    const result = advanceBraceScanState(content, i, state);
    i = result.index;
  }

  const stack: number[] = [];
  let targetOpen: number | null = null;

  for (let i = normalizedStart; i < normalizedEnd; i++) {
    const result = advanceBraceScanState(content, i, state);
    i = result.index;
    if (!result.canScanBraces) {
      continue;
    }

    const char = content[i];

    if (char === '{') {
      stack.push(i);
      if (targetOpen === null) {
        targetOpen = i;
      }
    } else if (char === '}') {
      if (targetOpen === null) {
        continue;
      }
      if (stack.length === 0) {
        return {
          error: {
            type: 'mismatched-closing-brace',
            index: i,
          },
        };
      }
      const openIndex = stack.pop()!;
      if (openIndex === targetOpen && stack.length === 0) {
        return {
          match: {
            openIndex,
            closeIndex: i,
          },
        };
      }
    }
  }

  if (targetOpen === null) {
    return {
      error: {
        type: 'missing-opening-brace-in-range',
        index: normalizedStart,
      },
    };
  }

  return {
    error: {
      type: 'missing-closing-brace',
      index: targetOpen,
    },
  };
}

export function formatBraceScanError(error: BraceScanError): string {
  switch (error.type) {
    case 'mismatched-closing-brace':
      return 'Mismatched closing brace found before matching opening brace while resolving END: "}".';
    case 'missing-closing-brace':
      return 'Missing closing brace for the first "{" in the selected range while resolving END: "}".';
    case 'missing-opening-brace-in-range':
      return 'No opening brace found in the selected range while resolving END: "}".';
    default:
      return 'Unable to resolve brace range for END: "}".';
  }
}
