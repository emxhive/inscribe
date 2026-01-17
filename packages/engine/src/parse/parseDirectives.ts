/**
 * Functions for parsing Inscribe directives
 */

import {
  VALID_MODES,
  DEFAULT_MODE,
  isValidMode,
  type Mode,
  parseDirectiveLine,
  DirectiveKey,
} from '@inscribe/shared';

export interface DirectiveParseResult {
  file: string;
  mode: Mode;
  directives: Record<string, string>;
  contentStartIndex: number;
  error?: string;
  warnings?: string[];
}

const DIRECTIVE_KEY_MAP: Partial<Record<DirectiveKey, string | null>> = {
  FILE: null,
  MODE: null,
  START: 'START',
  START_BEFORE: 'START_BEFORE',
  START_AFTER: 'START_AFTER',
  END: 'END',
  END_BEFORE: 'END_BEFORE',
  END_AFTER: 'END_AFTER',
  SCOPE_START: 'SCOPE_START',
  SCOPE_END: 'SCOPE_END',
};

/**
 * Parse directives from block lines
 * @param lines - Array of lines containing directives
 * @returns Parsed directives with file, mode, and optional warnings
 */
export function parseDirectives(lines: string[]): DirectiveParseResult {
  const directives: Record<string, string> = {};
  const warnings: string[] = [];
  let file = '';
  let mode: Mode = DEFAULT_MODE;
  let contentStartIndex = -1;

  // Extract directives
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    // Check for start of code fence
    if (trimmed.startsWith('```')) {
      contentStartIndex = i;
      break;
    }

    const parsed = parseDirectiveLine(trimmed);
    if (!parsed.matched) {
      if (parsed.usedPrefix && parsed.raw.trim()) {
        warnings.push(`Unknown directive: ${parsed.raw.trim()}`);
      }
      continue;
    }

    const directiveKey = DIRECTIVE_KEY_MAP[parsed.key!];
    const value = parsed.value ?? '';

    if (parsed.key === 'FILE') {
      file = value;
    } else if (parsed.key === 'MODE') {
      if (isValidMode(value)) {
        mode = value;
      } else {
        warnings.push(`Invalid MODE: ${value}. Using default: ${DEFAULT_MODE}`);
        mode = DEFAULT_MODE;
      }
    } else if (directiveKey) {
      directives[directiveKey] = value;
    }
  }

  if (!file) {
    return { 
      file: '', 
      mode: DEFAULT_MODE, 
      directives: {}, 
      contentStartIndex: -1, 
      error: 'Missing FILE directive' 
    };
  }

  return { file, mode, directives, contentStartIndex, warnings: warnings.length > 0 ? warnings : undefined };
}
