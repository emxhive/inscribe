import {
  HEADER_FILE,
  HEADER_MODE,
  DIRECTIVE_START_LINE_CONTAINS,
  DIRECTIVE_START_LINE_EQUALS,
  DIRECTIVE_END_LINE_CONTAINS,
  DIRECTIVE_END_LINE_EQUALS,
  DIRECTIVE_END_OCCURRENCE,
  DIRECTIVE_RANGE_CONTAINS,
  DIRECTIVE_RANGE_LINE_CONTAINS_ALL,
  DIRECTIVE_NAME,
  DIRECTIVE_START,
  DIRECTIVE_END,
  DIRECTIVE_CONTAINS,
  INSCRIBE_PREFIX,
  HEADER_KEYS,
  DIRECTIVE_KEYS,
  LEGACY_DIRECTIVE_KEYS,
  ALL_FIELD_KEYS,
  PARSE_FIELD_KEYS,
} from './constants';
import { startsWithMarker, extractMarkerValue } from './parseUtils';

export type HeaderKey = (typeof HEADER_KEYS)[number];
export type DirectiveKey = (typeof DIRECTIVE_KEYS)[number];
export type LegacyDirectiveKey = (typeof LEGACY_DIRECTIVE_KEYS)[number];
export type FieldKey = (typeof ALL_FIELD_KEYS)[number];
export type ParsedFieldKey = (typeof PARSE_FIELD_KEYS)[number];

export const FIELD_MARKERS: Record<ParsedFieldKey, string> = {
  FILE: HEADER_FILE,
  MODE: HEADER_MODE,
  START_LINE_CONTAINS: DIRECTIVE_START_LINE_CONTAINS,
  START_LINE_EQUALS: DIRECTIVE_START_LINE_EQUALS,
  END_LINE_CONTAINS: DIRECTIVE_END_LINE_CONTAINS,
  END_LINE_EQUALS: DIRECTIVE_END_LINE_EQUALS,
  END_OCCURRENCE: DIRECTIVE_END_OCCURRENCE,
  RANGE_CONTAINS: DIRECTIVE_RANGE_CONTAINS,
  RANGE_LINE_CONTAINS_ALL: DIRECTIVE_RANGE_LINE_CONTAINS_ALL,
  NAME: DIRECTIVE_NAME,
  START: DIRECTIVE_START,
  END: DIRECTIVE_END,
  CONTAINS: DIRECTIVE_CONTAINS,
};

export function isLegacyDirectiveKey(key: ParsedFieldKey): key is LegacyDirectiveKey {
  return (LEGACY_DIRECTIVE_KEYS as readonly string[]).includes(key);
}

export function formatLegacyDirectiveError(key: LegacyDirectiveKey): string {
  if (key === 'START') {
    return 'START is no longer supported. Use START_LINE_CONTAINS or START_LINE_EQUALS.';
  }
  if (key === 'END') {
    return 'END is no longer supported. Use END_LINE_CONTAINS or END_LINE_EQUALS.';
  }
  return 'CONTAINS is no longer supported. Use RANGE_CONTAINS.';
}

export interface ParsedDirectiveLine {
  matched: boolean;
  key?: ParsedFieldKey;
  value?: string;
  usedPrefix: boolean;
  raw: string;
}

export function parseDirectiveLine(line: string): ParsedDirectiveLine {
  const trimmed = line.trim();
  const usedPrefix = startsWithMarker(trimmed, INSCRIBE_PREFIX);
  if (usedPrefix) return { matched: false, usedPrefix: true, raw: line };

  for (const key of PARSE_FIELD_KEYS) {
    const marker = FIELD_MARKERS[key];
    if (startsWithMarker(trimmed, marker)) {
      return { matched: true, key, value: extractMarkerValue(trimmed, marker), usedPrefix: false, raw: line };
    }
  }

  return { matched: false, usedPrefix: false, raw: line };
}
