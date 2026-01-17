/**
 * Functions for parsing Inscribe headers and directives
 */

import {
  VALID_MODES,
  isValidMode,
  type Mode,
  parseDirectiveLine,
  FieldKey,
} from '@inscribe/shared';

export interface DirectiveParseResult {
  file: string;
  mode: Mode;
  directives: Record<string, string>;
  contentStartIndex: number;
  error?: string;
  warnings?: string[];
}

const FIELD_KEY_MAP: Partial<Record<FieldKey, string | null>> = {
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
 * Parse headers and directives from block lines
 * @param lines - Array of lines containing headers/directives
 * @returns Parsed headers/directives with file, mode, and optional warnings
 */
export function parseDirectives(lines: string[]): DirectiveParseResult {
  const directives: Record<string, string> = {};
  const warnings: string[] = [];
  let file = '';
  let mode: Mode | null = null;
  let modeError: string | null = null;
  let contentStartIndex = -1;

  // Extract headers and directives
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
        warnings.push(`Invalid directive format: ${parsed.raw.trim()} (headers and directives should not use @inscribe prefix)`);
      }
      continue;
    }

    const fieldKey = FIELD_KEY_MAP[parsed.key!];
    const value = parsed.value ?? '';

    if (parsed.key === 'FILE') {
      file = value;
    } else if (parsed.key === 'MODE') {
      if (!value) {
        modeError = 'Missing MODE header';
      } else if (isValidMode(value)) {
        mode = value;
      } else {
        modeError = `Invalid MODE header: ${value}`;
      }
    } else if (fieldKey) {
      directives[fieldKey] = value;
    }
  }

  if (!file) {
    return { 
      file: '', 
      mode: VALID_MODES[0], 
      directives: {}, 
      contentStartIndex: -1, 
      error: 'Missing FILE header',
    };
  }

  if (modeError) {
    return {
      file,
      mode: VALID_MODES[0],
      directives,
      contentStartIndex,
      error: modeError,
    };
  }

  if (!mode) {
    return {
      file,
      mode: VALID_MODES[0],
      directives,
      contentStartIndex,
      error: 'Missing MODE header',
    };
  }

  return { file, mode, directives, contentStartIndex, warnings: warnings.length > 0 ? warnings : undefined };
}
