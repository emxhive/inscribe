import { V2MatchMetadata } from '@inscribe/shared';
import { findFallbackMatch } from './fallbackMatch';

export function findExactMatch(content: string, search: string): number {
  if (!search) {
    throw new Error('INVALID_SEARCH: SEARCH must not be empty.');
  }
  const firstIndex = content.indexOf(search);
  if (firstIndex === -1) {
    return -1; // 0 matches
  }
  const secondIndex = content.indexOf(search, firstIndex + 1);
  if (secondIndex !== -1) {
    return -2; // multiple matches
  }
  return firstIndex; // exactly one match
}

export interface ReplacementResult {
  afterContent: string;
  beforeRange: { start: number; end: number };
  afterRange: { start: number; end: number };
  matchMetadata: V2MatchMetadata;
}

export function performReplaceText(content: string, search: string, replacement: string): ReplacementResult {
  const index = findExactMatch(content, search);
  if (index === -2) {
    throw new Error('MUTABLE_TARGET_AMBIGUOUS: Multiple matches found for search content.');
  }
  
  if (index >= 0) {
    const afterContent = content.slice(0, index) + replacement + content.slice(index + search.length);
    return {
      afterContent,
      beforeRange: { start: index, end: index + search.length },
      afterRange: { start: index, end: index + replacement.length },
      matchMetadata: {
        kind: 'exact',
        resolvedRange: { start: index, end: index + search.length }
      }
    };
  }

  // index === -1: try fallback matching
  const fallbackCandidates = findFallbackMatch(content, search);
  if (fallbackCandidates.length === 0) {
    throw new Error('TARGET_NOT_FOUND: Search content not found in file.');
  }
  if (fallbackCandidates.length > 1) {
    throw new Error('FALLBACK_TARGET_AMBIGUOUS: Multiple fallback matches found for search content.');
  }

  const candidate = fallbackCandidates[0];
  const start = candidate.resolvedRange.start;
  const end = candidate.resolvedRange.end;
  const afterContent = content.slice(0, start) + replacement + content.slice(end);

  return {
    afterContent,
    beforeRange: { start, end },
    afterRange: { start, end: start + replacement.length },
    matchMetadata: {
      kind: 'fallback',
      score: candidate.score,
      resolvedRange: { start, end },
      fallbackReason: 'exact_not_found',
      unmatchedSoftTokens: candidate.unmatchedSoftTokens
    }
  };
}

