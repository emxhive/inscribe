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

  const contains = (directives.RANGE_CONTAINS ?? '').split('\n').map(v => v.trim()).filter(Boolean);

  const candidates: { start: number; end: number }[] = [];
  for (const s of start.matches) {
    for (const e of end.matches) {
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
  const start = resolveBoundarySelector(content, directives, 'START');
  const end = resolveBoundarySelector(content, directives, 'END');

  if (start.value === VIRTUAL_START && end.value === VIRTUAL_END) {
    throw new Error('replace_between cannot target full file via virtual anchors; use replace_file');
  }

  const contains = (directives.RANGE_CONTAINS ?? '').split('\n').map(v => v.trim()).filter(Boolean);

  const candidates: { start: number; end: number; sameLine: boolean }[] = [];
  for (const s of start.matches) {
    for (const e of end.matches) {
      const sLineStart = start.isVirtual && s.start === 0 ? 0 : lineStart(content, s.start);
      const eLineStart = end.isVirtual && e.start === content.length ? content.length : lineStart(content, e.start);
      const sameLine = sLineStart === eLineStart;

      if (!sameLine && e.start < s.end) continue;

      if (sameLine && (start.strategy === 'equals' || end.strategy === 'equals')) {
        // Skip same-line matches if EQUALS strategy is used, per requirements.
        continue;
      }

      const lEnd = lineEnd(content, sLineStart);
      if (sameLine) {
        // Same-line interior edits are only valid with line-contains selectors.
        const lineText = content.slice(sLineStart, lEnd);
        const sOccs = findAllOccurrences(lineText, s.value);
        const eOccs = findAllOccurrences(lineText, e.value);

        for (const sOcc of sOccs) {
          for (const eOcc of eOccs) {
            if (eOcc.start < sOcc.end) continue;
            candidates.push({ start: sLineStart + sOcc.end, end: sLineStart + eOcc.start, sameLine: true });
          }
        }
      } else {
        const rStart = start.isVirtual && s.start === 0 ? 0 : lineEnd(content, s.end);
        const rEnd = end.isVirtual && e.start === content.length ? content.length : lineStart(content, e.start);

        if (rEnd >= rStart) {
          candidates.push({ start: rStart, end: rEnd, sameLine: false });
        }
      }
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
