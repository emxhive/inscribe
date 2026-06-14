export interface Token {
  text: string;
  isMeaningful: boolean;
  isSoft: boolean;
  isHardOp: boolean;
  start: number;
  end: number;
  originalIdx?: number;
}

const MULTI_CHAR_OPERATORS = [
  '===',
  '!==',
  '==',
  '!=',
  '<=',
  '>=',
  '&&',
  '||',
  '??',
  '?.',
  '=>',
  '->',
  '+=',
  '-=',
  '*=',
  '/=',
  '%=',
  '::',
  '...',
];

const SOFT_TOKENS = new Set(["'", '"', '`', ';', ',']);
const QUOTE_SOFT_TOKENS = new Set(["'", '"', '`']);
const SEPARATOR_SOFT_TOKENS = new Set([';', ',']);

function escapeRegexToken(token: string): string {
  return token.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
}

function isQuoteSoftToken(token: Token): boolean {
  return token.isSoft && QUOTE_SOFT_TOKENS.has(token.text);
}

function isSeparatorSoftToken(token: Token): boolean {
  return token.isSoft && SEPARATOR_SOFT_TOKENS.has(token.text);
}

function areSoftTokensCompatible(searchToken: Token, targetToken: Token): boolean {
  if (!searchToken.isSoft || !targetToken.isSoft) {
    return false;
  }

  if (isQuoteSoftToken(searchToken) && isQuoteSoftToken(targetToken)) {
    return true;
  }

  if (isSeparatorSoftToken(searchToken) && isSeparatorSoftToken(targetToken)) {
    return true;
  }

  return searchToken.text === targetToken.text;
}

export function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  const operatorPattern = MULTI_CHAR_OPERATORS.map(escapeRegexToken).join('|');
  const tokenRegex = new RegExp(`${operatorPattern}|[a-zA-Z0-9_]+|[^a-zA-Z0-9_\\s]`, 'g');

  let match;
  while ((match = tokenRegex.exec(text)) !== null) {
    const matchedText = match[0];
    const meaningful = /^[a-zA-Z0-9_]+$/.test(matchedText);
    const soft = SOFT_TOKENS.has(matchedText);
    const hardOp = !meaningful && !soft;

    tokens.push({
      text: matchedText,
      isMeaningful: meaningful,
      isSoft: soft,
      isHardOp: hardOp,
      start: match.index,
      end: match.index + matchedText.length,
    });
  }

  return tokens;
}

export interface FallbackMatchResult {
  score: number;
  resolvedRange: { start: number; end: number };
  unmatchedSoftTokens: string[];
}

function collectLeadingSoftRun(fileTokens: Token[], startIdx: number): number[] {
  const indices: number[] = [];
  for (let t = startIdx - 1; t >= 0; t--) {
    if (!fileTokens[t].isSoft) {
      break;
    }
    indices.push(t);
  }
  return indices;
}

function collectTrailingSoftRun(fileTokens: Token[], endIdx: number): number[] {
  const indices: number[] = [];
  for (let t = endIdx + 1; t < fileTokens.length; t++) {
    if (!fileTokens[t].isSoft) {
      break;
    }
    indices.push(t);
  }
  return indices;
}

function alignBoundarySoftTokens(
  searchBoundaryTokens: Token[],
  targetBoundaryIndices: number[],
  fileTokens: Token[],
  matchedTargetIndices: Set<number>,
  consumedTargetIndices: Set<number>,
  unmatchedSoftTokens: string[]
): number {
  let matchedSoftCount = 0;
  let targetRunIdx = 0;

  for (const searchToken of searchBoundaryTokens) {
    if (!searchToken.isSoft) {
      continue;
    }

    let foundInRunIdx = -1;
    for (let r = targetRunIdx; r < targetBoundaryIndices.length; r++) {
      const targetToken = fileTokens[targetBoundaryIndices[r]];
      if (areSoftTokensCompatible(searchToken, targetToken)) {
        foundInRunIdx = r;
        break;
      }
    }

    if (foundInRunIdx !== -1) {
      const targetIdx = targetBoundaryIndices[foundInRunIdx];
      matchedTargetIndices.add(targetIdx);
      consumedTargetIndices.add(targetIdx);
      matchedSoftCount++;
      targetRunIdx = foundInRunIdx + 1;
    } else {
      unmatchedSoftTokens.push(searchToken.text);
    }
  }

  // Consume compatible adjacent target soft tokens
  const hasSearchQuote = searchBoundaryTokens.some(isQuoteSoftToken);
  const hasSearchSeparator = searchBoundaryTokens.some(isSeparatorSoftToken);

  for (const targetIdx of targetBoundaryIndices) {
    const targetToken = fileTokens[targetIdx];
    const isQuote = isQuoteSoftToken(targetToken);
    const isSep = isSeparatorSoftToken(targetToken);

    if ((isQuote && hasSearchQuote) || (isSep && hasSearchSeparator)) {
      consumedTargetIndices.add(targetIdx);
    }
  }

  return matchedSoftCount;
}

export function findFallbackMatch(content: string, search: string): FallbackMatchResult[] {
  const searchTokens = tokenize(search).map((t, idx) => ({ ...t, originalIdx: idx }));
  const fileTokens = tokenize(content);

  const meaningfulSearchTokens = searchTokens.filter(t => t.isMeaningful);
  if (meaningfulSearchTokens.length < 5) {
    return [];
  }

  const searchRequiredTokens = searchTokens.filter(t => t.isMeaningful || t.isHardOp);
  if (searchRequiredTokens.length === 0) {
    return [];
  }

  const firstRequired = searchRequiredTokens[0];
  const lastRequired = searchRequiredTokens[searchRequiredTokens.length - 1];

  const startIndices: number[] = [];
  for (let i = 0; i < fileTokens.length; i++) {
    if (fileTokens[i].text === firstRequired.text) {
      startIndices.push(i);
    }
  }

  const candidates: FallbackMatchResult[] = [];

  for (const startIdx of startIndices) {
    let rIdx = 0;
    let fileIdx = startIdx;
    const matchedTargetIndices: number[] = [];

    while (rIdx < searchRequiredTokens.length && fileIdx < fileTokens.length) {
      if (fileTokens[fileIdx].text === searchRequiredTokens[rIdx].text) {
        matchedTargetIndices.push(fileIdx);
        rIdx++;
      }
      fileIdx++;
    }

    if (rIdx !== searchRequiredTokens.length) {
      continue;
    }

    const endIdx = matchedTargetIndices[matchedTargetIndices.length - 1];

    const resolvedStartChar = fileTokens[startIdx].start;
    const resolvedEndChar = fileTokens[endIdx].end;
    const resolvedSpanCharLength = resolvedEndChar - resolvedStartChar;
    if (resolvedSpanCharLength > 1.75 * search.length) {
      continue;
    }

    const targetSpanRequiredTokens = fileTokens
      .slice(startIdx, endIdx + 1)
      .filter(t => t.isMeaningful || t.isHardOp);
    if (targetSpanRequiredTokens.length !== searchRequiredTokens.length) {
      continue;
    }

    let requiredSequenceFailed = false;
    for (let i = 0; i < searchRequiredTokens.length; i++) {
      if (targetSpanRequiredTokens[i].text !== searchRequiredTokens[i].text) {
        requiredSequenceFailed = true;
        break;
      }
    }
    if (requiredSequenceFailed) {
      continue;
    }

    const allMatchedTargetIndices = new Set(matchedTargetIndices);
    const consumedTargetIndices = new Set(matchedTargetIndices);
    let matchedSoftCount = 0;
    const unmatchedSoftTokens: string[] = [];

    const firstReqIdx = firstRequired.originalIdx!;
    const lastReqIdx = lastRequired.originalIdx!;

    const leadingSearchSoftTokens = searchTokens.slice(0, firstReqIdx).reverse();
    const leadingSoftTargetIndices = collectLeadingSoftRun(fileTokens, startIdx);
    matchedSoftCount += alignBoundarySoftTokens(
      leadingSearchSoftTokens,
      leadingSoftTargetIndices,
      fileTokens,
      allMatchedTargetIndices,
      consumedTargetIndices,
      unmatchedSoftTokens,
    );

    const trailingSearchSoftTokens = searchTokens.slice(lastReqIdx + 1);
    const trailingSoftTargetIndices = collectTrailingSoftRun(fileTokens, endIdx);
    matchedSoftCount += alignBoundarySoftTokens(
      trailingSearchSoftTokens,
      trailingSoftTargetIndices,
      fileTokens,
      allMatchedTargetIndices,
      consumedTargetIndices,
      unmatchedSoftTokens,
    );

    for (let m = 0; m < searchRequiredTokens.length - 1; m++) {
      const sCurrentReq = searchRequiredTokens[m];
      const sNextReq = searchRequiredTokens[m + 1];
      const currentReqIdx = sCurrentReq.originalIdx!;
      const nextReqIdx = sNextReq.originalIdx!;

      const tCurrentReqIdx = matchedTargetIndices[m];
      const tNextReqIdx = matchedTargetIndices[m + 1];

      const gapSearchSofts = searchTokens
        .slice(currentReqIdx + 1, nextReqIdx)
        .filter(t => t.isSoft);
      if (gapSearchSofts.length === 0) {
        continue;
      }

      let tGapIdx = tCurrentReqIdx + 1;
      for (const searchSoft of gapSearchSofts) {
        let foundIdx = -1;
        for (let t = tGapIdx; t < tNextReqIdx; t++) {
          if (areSoftTokensCompatible(searchSoft, fileTokens[t])) {
            foundIdx = t;
            break;
          }
        }

        if (foundIdx !== -1) {
          allMatchedTargetIndices.add(foundIdx);
          consumedTargetIndices.add(foundIdx);
          matchedSoftCount++;
          tGapIdx = foundIdx + 1;
        } else {
          unmatchedSoftTokens.push(searchSoft.text);
        }
      }
    }

    let minChar = fileTokens[startIdx].start;
    let maxChar = fileTokens[endIdx].end;
    for (const idx of consumedTargetIndices) {
      minChar = Math.min(minChar, fileTokens[idx].start);
      maxChar = Math.max(maxChar, fileTokens[idx].end);
    }

    let minTokenIdx = startIdx;
    let maxTokenIdx = endIdx;
    for (let i = 0; i < fileTokens.length; i++) {
      if (fileTokens[i].start >= minChar && fileTokens[i].end <= maxChar) {
        minTokenIdx = Math.min(minTokenIdx, i);
        maxTokenIdx = Math.max(maxTokenIdx, i);
      }
    }

    const resolvedRequiredTokens = fileTokens
      .slice(minTokenIdx, maxTokenIdx + 1)
      .filter(t => t.isMeaningful || t.isHardOp);
    if (resolvedRequiredTokens.length !== searchRequiredTokens.length) {
      continue;
    }

    let finalInvariantFailed = false;
    for (let i = 0; i < searchRequiredTokens.length; i++) {
      if (resolvedRequiredTokens[i].text !== searchRequiredTokens[i].text) {
        finalInvariantFailed = true;
        break;
      }
    }
    if (finalInvariantFailed) {
      continue;
    }

    let unmatchedTargetSoftWeight = 0;
    for (let i = minTokenIdx; i <= maxTokenIdx; i++) {
      if (!allMatchedTargetIndices.has(i) && fileTokens[i].isSoft) {
        unmatchedTargetSoftWeight += 0.05;
      }
    }

    const matchedWeight = searchRequiredTokens.length + (matchedSoftCount * 0.05);
    const unmatchedSearchSoftWeight = unmatchedSoftTokens.length * 0.05;
    const totalWeight = matchedWeight + unmatchedSearchSoftWeight + unmatchedTargetSoftWeight;
    const score = matchedWeight / totalWeight;

    if (score >= 0.90) {
      candidates.push({
        score,
        resolvedRange: { start: minChar, end: maxChar },
        unmatchedSoftTokens,
      });
    }
  }

  const uniqueCandidates = new Map<string, FallbackMatchResult>();
  for (const candidate of candidates) {
    const key = `${candidate.resolvedRange.start}:${candidate.resolvedRange.end}`;
    const existing = uniqueCandidates.get(key);
    if (!existing || candidate.score > existing.score) {
      uniqueCandidates.set(key, candidate);
    }
  }

  return Array.from(uniqueCandidates.values());
}
