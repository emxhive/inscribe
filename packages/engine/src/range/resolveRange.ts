import { findAllOccurrences, MatchRange } from '../util/textSearch';

const START_KEYS = ['START', 'START_BEFORE', 'START_AFTER'] as const;
const END_KEYS = ['END', 'END_BEFORE', 'END_AFTER'] as const;

export type StartDirectiveKey = typeof START_KEYS[number];
export type EndDirectiveKey = typeof END_KEYS[number];
export type AnchorDirectiveKey = StartDirectiveKey | EndDirectiveKey;

export interface AnchorDirective {
  key: AnchorDirectiveKey;
  value: string;
}

export interface ResolvedRangeDirectiveShape {
  startDirective: AnchorDirective;
  endDirective: AnchorDirective | null;
  contains: string[];
}

export interface ResolvedRange {
  startDirective: AnchorDirective;
  endDirective: AnchorDirective | null;
  startMatch: MatchRange;
  endMatch: MatchRange | null;
  replaceStart: number;
  replaceEnd: number;
}

export function resolveRange(
  content: string,
  directives: Record<string, string> = {}
): ResolvedRange {
  const { startDirective, endDirective, contains } = resolveRangeDirectiveShape(directives);

  const startMatches = findAllOccurrences(content, startDirective.value);

  if (startMatches.length === 0) {
    throw new Error(`${startDirective.key} anchor not found: "${startDirective.value}"`);
  }

  const endMatches = endDirective
    ? findAllOccurrences(content, endDirective.value)
    : [];

  if (endDirective && endMatches.length === 0) {
    throw new Error(`${endDirective.key} anchor not found: "${endDirective.value}"`);
  }

  const candidateStartMatches = contains.length > 0
    ? filterStartMatchesByContains(content, startMatches, endMatches, contains)
    : startMatches;

  if (candidateStartMatches.length === 0) {
    throw new Error(`No range candidate matched ${startDirective.key} + CONTAINS`);
  }

  if (candidateStartMatches.length > 1) {
    throw new Error(`${startDirective.key} anchor matches multiple times (${candidateStartMatches.length}), must match exactly once`);
  }

  const startMatch = candidateStartMatches[0];
  const endMatch = endDirective
    ? findFirstMatchAfter(endMatches, startMatch) ?? null
    : null;

  if (endDirective && !endMatch) {
    throw new Error(`${endDirective.key} anchor not found after ${startDirective.key}`);
  }

  const { replaceStart, replaceEnd } = endDirective && endMatch
    ? resolveBoundedReplacementRange(content, startDirective, startMatch, endDirective, endMatch)
    : resolveSingleLineReplacementRange(content, startMatch, startDirective.key);

  return {
    startDirective,
    endDirective,
    startMatch,
    endMatch,
    replaceStart,
    replaceEnd,
  };
}

export function resolveRangeDirectiveShape(
  directives: Record<string, string> = {}
): ResolvedRangeDirectiveShape {
  if (directives.SCOPE_START || directives.SCOPE_END) {
    throw new Error('SCOPE_START and SCOPE_END are no longer supported. Use START/END with optional CONTAINS instead.');
  }

  const startDirective = getRequiredAnchorDirective(directives, START_KEYS, 'START');
  const endDirective = getOptionalAnchorDirective(directives, END_KEYS, 'END');
  const contains = parseContains(directives.CONTAINS);

  if (contains.length > 0 && !endDirective) {
    throw new Error('CONTAINS requires END/END_BEFORE/END_AFTER to define a bounded candidate range');
  }

  return {
    startDirective,
    endDirective,
    contains,
  };
}

function getRequiredAnchorDirective(
  directives: Record<string, string>,
  keys: readonly AnchorDirectiveKey[],
  label: string
): AnchorDirective {
  const directive = getAnchorDirective(directives, keys, label);
  if (!directive) {
    throw new Error(`Range operation requires exactly one of ${keys.join(', ')} directives`);
  }
  return directive;
}

function getOptionalAnchorDirective(
  directives: Record<string, string>,
  keys: readonly AnchorDirectiveKey[],
  label: string
): AnchorDirective | null {
  return getAnchorDirective(directives, keys, label);
}

function getAnchorDirective(
  directives: Record<string, string>,
  keys: readonly AnchorDirectiveKey[],
  label: string
): AnchorDirective | null {
  const matches = keys
    .map(key => ({ key, value: directives[key] }))
    .filter((entry): entry is AnchorDirective => Boolean(entry.value));

  if (matches.length === 0) {
    return null;
  }

  if (matches.length > 1) {
    throw new Error(`Multiple ${label} directives provided; use only one of ${keys.join(', ')}`);
  }

  return matches[0];
}

function parseContains(value: string | undefined): string[] {
  return (value ?? '')
    .split('\n')
    .map(entry => entry.trim())
    .filter(Boolean);
}

function filterStartMatchesByContains(
  content: string,
  startMatches: MatchRange[],
  endMatches: MatchRange[],
  contains: string[]
): MatchRange[] {
  return startMatches.filter(startMatch => {
    const endMatch = findFirstMatchAfter(endMatches, startMatch);
    if (!endMatch) {
      return false;
    }

    const candidate = content.slice(startMatch.start, endMatch.end);
    return contains.every(value => candidate.includes(value));
  });
}

function resolveBoundedReplacementRange(
  content: string,
  startDirective: AnchorDirective,
  startMatch: MatchRange,
  endDirective: AnchorDirective,
  endMatch: MatchRange
): { replaceStart: number; replaceEnd: number } {
  const replaceStart = resolveReplacementStart(content, startMatch, startDirective.key);
  const replaceEnd = resolveReplacementEnd(content, endMatch, endDirective.key);

  if (replaceStart >= replaceEnd) {
    throw new Error('END anchor must come after START anchor');
  }

  return { replaceStart, replaceEnd };
}

function findFirstMatchAfter(matches: MatchRange[], startMatch: MatchRange): MatchRange | undefined {
  return matches.find(match => match.start >= startMatch.end);
}

function resolveReplacementStart(content: string, match: MatchRange, directiveKey: AnchorDirectiveKey): number {
  switch (directiveKey) {
    case 'START':
      return getLineStart(content, match.start);
    case 'START_BEFORE':
      return getPreviousLineStart(content, match.start);
    case 'START_AFTER':
      return getLineEnd(content, match.end);
    default:
      return getLineEnd(content, match.end);
  }
}

function resolveReplacementEnd(content: string, match: MatchRange, directiveKey: AnchorDirectiveKey): number {
  switch (directiveKey) {
    case 'END':
      return getLineEnd(content, match.end);
    case 'END_BEFORE':
      return getLineStart(content, match.start);
    case 'END_AFTER':
      return getNextLineEnd(content, match.end);
    default:
      return match.start;
  }
}

function resolveSingleLineReplacementRange(
  content: string,
  match: MatchRange,
  directiveKey: AnchorDirectiveKey
): { replaceStart: number; replaceEnd: number } {
  switch (directiveKey) {
    case 'START_BEFORE': {
      const lineStart = getPreviousLineStart(content, match.start);
      return { replaceStart: lineStart, replaceEnd: getLineEnd(content, lineStart) };
    }
    case 'START_AFTER': {
      const lineStart = getLineEnd(content, match.end);
      return { replaceStart: lineStart, replaceEnd: getLineEnd(content, lineStart) };
    }
    case 'START':
    default: {
      const lineStart = getLineStart(content, match.start);
      return { replaceStart: lineStart, replaceEnd: getLineEnd(content, match.end) };
    }
  }
}

function getLineStart(content: string, index: number): number {
  const newline = content.lastIndexOf('\n', index - 1);
  return newline === -1 ? 0 : newline + 1;
}

function getPreviousLineStart(content: string, index: number): number {
  const lineStart = getLineStart(content, index);
  if (lineStart === 0) {
    return 0;
  }
  const previousNewline = content.lastIndexOf('\n', lineStart - 2);
  return previousNewline === -1 ? 0 : previousNewline + 1;
}

function getLineEnd(content: string, index: number): number {
  const newline = content.indexOf('\n', index);
  return newline === -1 ? content.length : newline + 1;
}

function getNextLineEnd(content: string, index: number): number {
  const lineEnd = getLineEnd(content, index);
  if (lineEnd >= content.length) {
    return content.length;
  }
  return getLineEnd(content, lineEnd);
}
