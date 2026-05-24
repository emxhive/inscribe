import {
  VIRTUAL_START,
  VIRTUAL_END,
  lineStart,
  lineEnd,
  resolveAnchors,
  filterCandidates,
  formatAnchorNotFound,
  formatAnchorAmbiguous,
  formatRangeAmbiguous,
  formatNoCandidateMatched,
} from './targetUtils';

export interface ResolvedRange {
  replaceStart: number;
  replaceEnd: number;
}

export function resolveLineTarget(content: string, directives: Record<string, string>): ResolvedRange {
  const start = directives.START?.trim();
  if (!start) throw new Error('Missing required START directive');
  if (start === VIRTUAL_START || start === VIRTUAL_END) {
    throw new Error('replace_line requires non-virtual START directive');
  }

  const matches = resolveAnchors(content, start);
  if (matches.length === 0) throw new Error(formatAnchorNotFound('START', start));
  if (matches.length > 1) throw new Error(formatAnchorAmbiguous('START', matches.length));

  return {
    replaceStart: lineStart(content, matches[0].start),
    replaceEnd: lineEnd(content, matches[0].end),
  };
}

export function resolveRangeTarget(content: string, directives: Record<string, string>): ResolvedRange {
  const start = directives.START?.trim();
  const end = directives.END?.trim();
  if (!start) throw new Error('Missing required START directive');
  if (!end) throw new Error('Missing required END directive');

  if (start === VIRTUAL_START && end === VIRTUAL_END) {
    throw new Error('replace_range cannot target full file via virtual anchors; use replace_file');
  }

  const starts = resolveAnchors(content, start);
  const ends = resolveAnchors(content, end);
  const contains = (directives.CONTAINS ?? '').split('\n').map(v => v.trim()).filter(Boolean);

  const candidates: { start: number; end: number }[] = [];
  for (const s of starts) {
    for (const e of ends) {
      if (e.start < s.end) continue;
      candidates.push({ start: lineStart(content, s.start), end: lineEnd(content, e.end) });
    }
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
  const start = directives.START?.trim();
  const end = directives.END?.trim();
  if (!start) throw new Error('Missing required START directive');
  if (!end) throw new Error('Missing required END directive');

  if (start === VIRTUAL_START && end === VIRTUAL_END) {
    throw new Error('replace_between cannot target full file via virtual anchors; use replace_file');
  }

  const starts = resolveAnchors(content, start);
  const ends = resolveAnchors(content, end);
  const contains = (directives.CONTAINS ?? '').split('\n').map(v => v.trim()).filter(Boolean);

  const candidates: { start: number; end: number }[] = [];
  for (const s of starts) {
    for (const e of ends) {
      if (e.start < s.end) continue;

      const sameLine = lineStart(content, s.start) === lineStart(content, e.start);
      let rStart = start === VIRTUAL_START ? 0 : lineEnd(content, s.end);
      let rEnd = end === VIRTUAL_END ? content.length : lineStart(content, e.start);

      if (sameLine && start !== VIRTUAL_START && end !== VIRTUAL_END) {
        rStart = s.end;
        rEnd = e.start;
      }

      if (rEnd < rStart) continue;
      candidates.push({ start: rStart, end: rEnd });
    }
  }

  const filtered = filterCandidates(content, candidates, contains);
  if (filtered.length === 0) throw new Error(formatNoCandidateMatched());
  if (filtered.length > 1) throw new Error(formatRangeAmbiguous(filtered.length));

  return {
    replaceStart: filtered[0].start,
    replaceEnd: filtered[0].end,
  };
}
