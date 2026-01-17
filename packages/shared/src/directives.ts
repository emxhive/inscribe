import {
  DIRECTIVE_FILE,
  DIRECTIVE_MODE,
  DIRECTIVE_START,
  DIRECTIVE_START_BEFORE,
  DIRECTIVE_START_AFTER,
  DIRECTIVE_END,
  DIRECTIVE_END_BEFORE,
  DIRECTIVE_END_AFTER,
  DIRECTIVE_SCOPE_START,
  DIRECTIVE_SCOPE_END,
  INSCRIBE_PREFIX,
  DIRECTIVE_KEYS,
} from './constants';
import { startsWithMarker, extractMarkerValue } from './parseUtils';

export type DirectiveKey = (typeof DIRECTIVE_KEYS)[number];

export const DIRECTIVE_MARKERS: Record<DirectiveKey, string> = {
  FILE: DIRECTIVE_FILE,
  MODE: DIRECTIVE_MODE,
  START: DIRECTIVE_START,
  START_BEFORE: DIRECTIVE_START_BEFORE,
  START_AFTER: DIRECTIVE_START_AFTER,
  END: DIRECTIVE_END,
  END_BEFORE: DIRECTIVE_END_BEFORE,
  END_AFTER: DIRECTIVE_END_AFTER,
  SCOPE_START: DIRECTIVE_SCOPE_START,
  SCOPE_END: DIRECTIVE_SCOPE_END,
};

export interface ParsedDirectiveLine {
  matched: boolean;
  key?: DirectiveKey;
  value?: string;
  usedPrefix: boolean;
  raw: string;
}

/**
 * Parse a single directive line, supporting optional @inscribe prefix.
 * Returns matched=false when the line does not correspond to a known directive.
 */
export function parseDirectiveLine(line: string): ParsedDirectiveLine {
  const trimmed = line.trim();
  const usedPrefix = startsWithMarker(trimmed, INSCRIBE_PREFIX);
  const directiveLine = usedPrefix ? extractMarkerValue(trimmed, INSCRIBE_PREFIX) : trimmed;

  for (const key of DIRECTIVE_KEYS) {
    const marker = DIRECTIVE_MARKERS[key];
    if (startsWithMarker(directiveLine, marker)) {
      return {
        matched: true,
        key,
        value: extractMarkerValue(directiveLine, marker),
        usedPrefix,
        raw: line,
      };
    }
  }

  return { matched: false, usedPrefix, raw: line };
}
