import * as fs from 'fs';
import { Operation } from '@inscribe/shared';
import { findAllOccurrences, MatchRange } from '../util/textSearch';

/**
 * Apply range replace operation
 */
export function applyRangeReplace(filePath: string, operation: Operation): void {
  const content = fs.readFileSync(filePath, 'utf-8');
  const directives = operation.directives || {};
  const startDirectives = getAnchorDirectives(directives, ['START', 'START_BEFORE', 'START_AFTER'], 'START');
  const endDirectives = getAnchorDirectives(directives, ['END', 'END_BEFORE', 'END_AFTER'], 'END');
  const { SCOPE_START, SCOPE_END } = directives;

  if (!startDirectives || !endDirectives) {
    throw new Error('Range operation requires exactly one of START, START_BEFORE, START_AFTER and one of END, END_BEFORE, END_AFTER directives');
  }

  if ((SCOPE_START && !SCOPE_END) || (!SCOPE_START && SCOPE_END)) {
    throw new Error('Both SCOPE_START and SCOPE_END must be provided together');
  }

  let searchContent = content;
  let searchOffset = 0;

  if (SCOPE_START && SCOPE_END) {
    const scopeStartMatches = findAllOccurrences(content, SCOPE_START);
    const scopeEndMatches = findAllOccurrences(content, SCOPE_END);

    if (scopeStartMatches.length === 0) {
      throw new Error(`SCOPE_START anchor not found: "${SCOPE_START}"`);
    }

    if (scopeEndMatches.length === 0) {
      throw new Error(`SCOPE_END anchor not found: "${SCOPE_END}"`);
    }

    if (scopeStartMatches.length > 1) {
      throw new Error(`SCOPE_START anchor matches multiple times (${scopeStartMatches.length}), must match exactly once`);
    }

    const scopeStartMatch = scopeStartMatches[0];
    const scopeEndMatch = findFirstMatchAfter(scopeEndMatches, scopeStartMatch);

    if (!scopeEndMatch) {
      throw new Error('SCOPE_END anchor not found after SCOPE_START');
    }

    searchContent = content.substring(scopeStartMatch.start, scopeEndMatch.end);
    searchOffset = scopeStartMatch.start;
  }

  const startMatches = findAllOccurrences(searchContent, startDirectives.value);
  const endMatches = findAllOccurrences(searchContent, endDirectives.value);

  if (startMatches.length === 0) {
    throw new Error(`${startDirectives.key} anchor not found: "${startDirectives.value}"`);
  }

  if (endMatches.length === 0) {
    throw new Error(`${endDirectives.key} anchor not found: "${endDirectives.value}"`);
  }

  if (startMatches.length > 1) {
    throw new Error(`${startDirectives.key} anchor matches multiple times (${startMatches.length}), must match exactly once`);
  }

  const startMatch = startMatches[0];
  const endMatch = findFirstMatchAfter(endMatches, startMatch);

  if (!endMatch) {
    throw new Error(`${endDirectives.key} anchor not found after ${startDirectives.key}`);
  }

  const absoluteStartMatch = {
    start: searchOffset + startMatch.start,
    end: searchOffset + startMatch.end,
  };
  const absoluteEndMatch = {
    start: searchOffset + endMatch.start,
    end: searchOffset + endMatch.end,
  };
  const absoluteStartPos = resolveReplacementStart(content, absoluteStartMatch, startDirectives.key);
  const absoluteEndPos = resolveReplacementEnd(content, absoluteEndMatch, endDirectives.key);

  if (absoluteStartPos >= absoluteEndPos) {
    throw new Error('END anchor must come after START anchor');
  }

  const newContent =
    content.substring(0, absoluteStartPos) +
    operation.content +
    content.substring(absoluteEndPos);

  fs.writeFileSync(filePath, newContent);
}

function getAnchorDirectives(
  directives: Record<string, string>,
  keys: readonly string[],
  label: string
): { key: string; value: string } | null {
  const matches = keys
    .map(key => ({ key, value: directives[key] }))
    .filter(entry => entry.value);
  if (matches.length === 0) {
    return null;
  }
  if (matches.length > 1) {
    throw new Error(`Multiple ${label} directives provided; use only one of ${keys.join(', ')}`);
  }
  return matches[0];
}

function findFirstMatchAfter(matches: MatchRange[], startMatch: MatchRange): MatchRange | undefined {
  return matches.find(match => match.start >= startMatch.end);
}

function resolveReplacementStart(content: string, match: MatchRange, directiveKey: string): number {
  switch (directiveKey) {
    case 'START':
      return match.start;
    case 'START_BEFORE':
      return getPreviousLineStart(content, match.start);
    case 'START_AFTER':
      return match.end;
    default:
      return match.end;
  }
}

function resolveReplacementEnd(content: string, match: MatchRange, directiveKey: string): number {
  switch (directiveKey) {
    case 'END':
      return match.end;
    case 'END_BEFORE':
      return getLineStart(content, match.start);
    case 'END_AFTER':
      return getNextLineEnd(content, match.end);
    default:
      return match.start;
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

function getNextLineEnd(content: string, index: number): number {
  const lineEnd = content.indexOf('\n', index);
  if (lineEnd === -1) {
    return content.length;
  }
  const nextLineEnd = content.indexOf('\n', lineEnd + 1);
  return nextLineEnd === -1 ? content.length : nextLineEnd + 1;
}
