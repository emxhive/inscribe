import {
  HEADER_FILE,
  HEADER_MODE,
  DIRECTIVE_START,
  DIRECTIVE_START_BEFORE,
  DIRECTIVE_START_AFTER,
  DIRECTIVE_END,
  DIRECTIVE_END_BEFORE,
  DIRECTIVE_END_AFTER,
  DIRECTIVE_SCOPE_START,
  DIRECTIVE_SCOPE_END,
  INSCRIBE_PREFIX,
  HEADER_KEYS,
  DIRECTIVE_KEYS,
  ALL_FIELD_KEYS,
} from './constants';
import { startsWithMarker, extractMarkerValue } from './parseUtils';

export type HeaderKey = (typeof HEADER_KEYS)[number];
export type DirectiveKey = (typeof DIRECTIVE_KEYS)[number];
export type FieldKey = (typeof ALL_FIELD_KEYS)[number];

export const FIELD_MARKERS: Record<FieldKey, string> = {
  FILE: HEADER_FILE,
  MODE: HEADER_MODE,
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
  key?: FieldKey;
  value?: string;
  usedPrefix: boolean;
  raw: string;
}

/**
 * Parse a single header or directive line.
 * @inscribe prefix is NOT accepted for headers/directives - only BEGIN/END use the prefix.
 * Returns matched=false when the line does not correspond to a known field.
 */
export function parseDirectiveLine(line: string): ParsedDirectiveLine {
  const trimmed = line.trim();
  const usedPrefix = startsWithMarker(trimmed, INSCRIBE_PREFIX);
  
  // If prefix is used, reject it for headers/directives
  // (only BEGIN/END should use the prefix)
  if (usedPrefix) {
    return { matched: false, usedPrefix: true, raw: line };
  }

  // Check all field markers (headers + directives) without prefix
  for (const key of ALL_FIELD_KEYS) {
    const marker = FIELD_MARKERS[key];
    if (startsWithMarker(trimmed, marker)) {
      return {
        matched: true,
        key,
        value: extractMarkerValue(trimmed, marker),
        usedPrefix: false,
        raw: line,
      };
    }
  }

  return { matched: false, usedPrefix: false, raw: line };
}
