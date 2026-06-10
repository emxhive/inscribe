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
}

export function performReplaceText(content: string, search: string, replacement: string): ReplacementResult {
  const index = findExactMatch(content, search);
  if (index === -1) {
    throw new Error('TARGET_NOT_FOUND: Search content not found in file.');
  }
  if (index === -2) {
    throw new Error('MUTABLE_TARGET_AMBIGUOUS: Multiple matches found for search content.');
  }
  const afterContent = content.slice(0, index) + replacement + content.slice(index + search.length);
  return {
    afterContent,
    beforeRange: { start: index, end: index + search.length },
    afterRange: { start: index, end: index + replacement.length }
  };
}
