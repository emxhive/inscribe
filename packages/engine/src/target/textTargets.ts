import {
  VIRTUAL_START,
  VIRTUAL_END,
  lineStart,
  lineEnd,
  filterCandidates,
  formatAnchorNotFound,
  formatAnchorAmbiguous,
  formatRangeAmbiguous,
  formatNoCandidateMatched,
  findAllOccurrences,
  resolveBoundarySelector,
} from './targetUtils';

export interface ResolvedRange {
  replaceStart: number;
  replaceEnd: number;
}

type BoundarySelector = ReturnType<typeof resolveBoundarySelector>;
type BoundaryMatch = BoundarySelector['matches'][number];
type RangeCandidate = { start: number; end: number };
type BetweenCandidate = RangeCandidate & { sameLine: boolean };

function getRangeContains(directives: Record<string, string>): string[] {
  return (directives.RANGE_CONTAINS ?? '')
    .split('\n')
    .map((value) => value.trim())
    .filter(Boolean);
}

function parseEndOccurrence(directives: Record<string, string>): number {
  const raw = directives.END_OCCURRENCE?.trim();
  if (raw === undefined || raw.length === 0) {
    return 1;
  }

  if (!/^[1-9]\d*$/.test(raw)) {
    throw new Error('END_OCCURRENCE must be a positive integer');
  }

  return Number(raw);
}

function selectEndForStart(
  endMatches: BoundaryMatch[],
  startMatch: BoundaryMatch,
  occurrence: number,
  allowSameLine = false,
  maxEndStart?: number,
): BoundaryMatch | null {
  const minimumEndStart = allowSameLine ? startMatch.start : startMatch.end;
  const matchingEnds = endMatches.filter((endMatch) => (
    endMatch.start >= minimumEndStart &&
    (maxEndStart === undefined || endMatch.start < maxEndStart)
  ));
  return matchingEnds[occurrence - 1] ?? null;
}



function buildRangeCandidates(
  content: string,
  starts: BoundaryMatch[],
  ends: BoundaryMatch[],
  occurrence: number,
): RangeCandidate[] {
  return starts.flatMap((startMatch, index) => {
    const nextStart = starts[index + 1]?.start;
    const endMatch = selectEndForStart(ends, startMatch, occurrence, false, nextStart);
    if (!endMatch) {
      return [];
    }

    return [{
      start: lineStart(content, startMatch.start),
      end: lineEnd(content, endMatch.end),
    }];
  });
}


function resolveSameLineInteriors(
  content: string,
  startSelector: BoundarySelector,
  endSelector: BoundarySelector,
  startMatch: BoundaryMatch,
  endMatch: BoundaryMatch,
  lineStartOffset: number,
): BetweenCandidate[] {
  if (startSelector.strategy === 'equals' || endSelector.strategy === 'equals') {
    return [];
  }

  const lineText = content.slice(lineStartOffset, lineEnd(content, lineStartOffset));
  const startOccurrences = findAllOccurrences(lineText, startMatch.value);
  const endOccurrences = findAllOccurrences(lineText, endMatch.value);
  const candidates: BetweenCandidate[] = [];

  for (const startOccurrence of startOccurrences) {
    for (const endOccurrence of endOccurrences) {
      if (endOccurrence.start < startOccurrence.end) {
        continue;
      }

      candidates.push({
        start: lineStartOffset + startOccurrence.end,
        end: lineStartOffset + endOccurrence.start,
        sameLine: true,
      });
    }
  }

  return candidates;
}


function buildBetweenCandidates(
  content: string,
  startSelector: BoundarySelector,
  endSelector: BoundarySelector,
  occurrence: number,
): BetweenCandidate[] {
  return startSelector.matches.flatMap((startMatch, index) => {
    const nextStart = startSelector.matches[index + 1]?.start;
    const endMatch = selectEndForStart(endSelector.matches, startMatch, occurrence, true, nextStart);
    if (!endMatch) {
      return [];
    }

    const startLineStart = startSelector.isVirtual && startMatch.start === 0 ? 0 : lineStart(content, startMatch.start);
    const endLineStart = endSelector.isVirtual && endMatch.start === content.length
      ? content.length
      : lineStart(content, endMatch.start);
    const sameLine = startLineStart === endLineStart;

    if (sameLine) {
      return resolveSameLineInteriors(
        content,
        startSelector,
        endSelector,
        startMatch,
        endMatch,
        startLineStart,
      );
    }

    const replaceStart = startSelector.isVirtual && startMatch.start === 0 ? 0 : lineEnd(content, startMatch.end);
    const replaceEnd = endSelector.isVirtual && endMatch.start === content.length
      ? content.length
      : lineStart(content, endMatch.start);

    if (replaceEnd < replaceStart) {
      return [];
    }

    return [{ start: replaceStart, end: replaceEnd, sameLine: false }];
  });
}



function assertBoundaryMatches(start: BoundarySelector, end: BoundarySelector): void {
  if (start.matches.length === 0) throw new Error(formatAnchorNotFound(start.name, start.value));
  if (end.matches.length === 0) throw new Error(formatAnchorNotFound(end.name, end.value));
}

export function resolveLineTarget(content: string, directives: Record<string, string>): ResolvedRange {
  const start = resolveBoundarySelector(content, directives, 'START');
  if (start.isVirtual) {
    throw new Error('replace_line requires non-virtual START boundary');
  }

  if (start.matches.length === 0) throw new Error(formatAnchorNotFound(start.name, start.value));
  if (start.matches.length > 1) throw new Error(formatAnchorAmbiguous(start.name, start.matches.length));

  return {
    replaceStart: lineStart(content, start.matches[0].start),
    replaceEnd: lineEnd(content, start.matches[0].end),
  };
}

export function resolveRangeTarget(content: string, directives: Record<string, string>): ResolvedRange {
  const start = resolveBoundarySelector(content, directives, 'START');
  const end = resolveBoundarySelector(content, directives, 'END');

  if (start.value === VIRTUAL_START && end.value === VIRTUAL_END) {
    throw new Error('replace_range cannot target full file via virtual anchors; use replace_file');
  }

  assertBoundaryMatches(start, end);

  const occurrence = parseEndOccurrence(directives);
  const contains = getRangeContains(directives);
  const candidates = buildRangeCandidates(content, start.matches, end.matches, occurrence);

  if (candidates.length === 0) {
    throw new Error(`No END boundary occurrence ${occurrence} found after START boundary matches`);
  }

  const filtered = filterCandidates(content, candidates, contains);
  if (filtered.length === 0) throw new Error(formatNoCandidateMatched());
  if (filtered.length > 1) throw new Error(formatRangeAmbiguous(filtered.length));

  return {
    replaceStart: filtered[0].start,
    replaceEnd: filtered[0].end,
  };
}

export function resolveBetweenTarget(content: string, directives: Record<string, string>): ResolvedRange {
  const start = resolveBoundarySelector(content, directives, 'START');
  const end = resolveBoundarySelector(content, directives, 'END');

  if (start.value === VIRTUAL_START && end.value === VIRTUAL_END) {
    throw new Error('replace_between cannot target full file via virtual anchors; use replace_file');
  }

  assertBoundaryMatches(start, end);

  const occurrence = parseEndOccurrence(directives);
  const contains = getRangeContains(directives);
  const candidates = buildBetweenCandidates(content, start, end, occurrence);

  if (candidates.length === 0) {
    throw new Error(formatNoCandidateMatched());
  }

  const filtered = filterCandidates(content, candidates, contains);
  if (filtered.length === 0) throw new Error(formatNoCandidateMatched());
  if (filtered.length > 1) throw new Error(formatRangeAmbiguous(filtered.length));

  return {
    replaceStart: filtered[0].start,
    replaceEnd: filtered[0].end,
  };
}