import { findAllOccurrences, MatchRange } from '../util/textSearch';
import { findBraceRangeFromSelection, formatBraceScanError } from '../util/braceScan';

export const VIRTUAL_START = '::START_OF_FILE';
export const VIRTUAL_END = '::END_OF_FILE';

export interface ResolvedRangeDirectiveShape { startDirective: { key: 'START'; value: string }; endDirective: { key: 'END'; value: string }; contains: string[]; }
export interface ResolvedRange { replaceStart: number; replaceEnd: number; }

export function resolveRangeDirectiveShape(directives: Record<string, string> = {}): ResolvedRangeDirectiveShape {
  const start = directives.START?.trim(); const end = directives.END?.trim();
  if (!start) throw new Error('Missing required START directive');
  if (!end) throw new Error('Missing required END directive');
  const contains = (directives.CONTAINS ?? '').split('\n').map(v => v.trim()).filter(Boolean);
  return { startDirective: { key: 'START', value: start }, endDirective: { key: 'END', value: end }, contains };
}

function lineStart(content: string, idx: number): number { const n = content.lastIndexOf('\n', Math.max(0, idx - 1)); return n === -1 ? 0 : n + 1; }
function lineEnd(content: string, idx: number): number { const n = content.indexOf('\n', idx); return n === -1 ? content.length : n + 1; }

function filterCandidates(content: string, candidates: { start: number; end: number }[], contains: string[]): { start: number; end: number }[] {
  if (contains.length === 0) return candidates;
  return candidates.filter((c) => { const text = content.slice(c.start, c.end); return contains.every((v) => text.includes(v)); });
}

export function resolveReplaceLine(content: string, directives: Record<string, string> = {}): ResolvedRange {
  const start = directives.START?.trim();
  if (!start || start === VIRTUAL_START || start === VIRTUAL_END) throw new Error('replace_line requires non-virtual START directive');
  const matches = findAllOccurrences(content, start);
  if (matches.length !== 1) throw new Error(matches.length === 0 ? `START anchor not found: "${start}"` : `START anchor is ambiguous (${matches.length} matches)`);
  return { replaceStart: lineStart(content, matches[0].start), replaceEnd: lineEnd(content, matches[0].end) };
}

export function resolveReplaceRange(content: string, directives: Record<string, string> = {}): ResolvedRange {
  const { startDirective, endDirective, contains } = resolveRangeDirectiveShape(directives);
  if (startDirective.value === VIRTUAL_START && endDirective.value === VIRTUAL_END) throw new Error('replace_range cannot target full file via virtual anchors; use replace_file');
  const starts = startDirective.value === VIRTUAL_START ? [{ start: 0, end: 0 }] : findAllOccurrences(content, startDirective.value);
  const ends = endDirective.value === VIRTUAL_END ? [{ start: content.length, end: content.length }] : findAllOccurrences(content, endDirective.value);
  const candidates: { start: number; end: number }[] = [];
  for (const s of starts) {
    for (const e of ends) {
      if (e.start < s.end) continue;
      candidates.push({ start: lineStart(content, s.start), end: lineEnd(content, e.end) });
    }
  }
  const filtered = filterCandidates(content, candidates, contains);
  if (filtered.length !== 1) throw new Error(filtered.length === 0 ? 'No range candidate matched START + END + CONTAINS' : `Range is ambiguous (${filtered.length} matches)`);
  return { replaceStart: filtered[0].start, replaceEnd: filtered[0].end };
}

export function resolveReplaceBetween(content: string, directives: Record<string, string> = {}): ResolvedRange {
  const { startDirective, endDirective, contains } = resolveRangeDirectiveShape(directives);
  if (startDirective.value === VIRTUAL_START && endDirective.value === VIRTUAL_END) throw new Error('replace_between cannot target full file via virtual anchors; use replace_file');
  const starts = startDirective.value === VIRTUAL_START ? [{ start: 0, end: 0 }] : findAllOccurrences(content, startDirective.value);
  const ends = endDirective.value === VIRTUAL_END ? [{ start: content.length, end: content.length }] : findAllOccurrences(content, endDirective.value);
  const candidates: { start: number; end: number }[] = [];
  for (const s of starts) for (const e of ends) {
    if (e.start < s.end) continue;
    const start = startDirective.value === VIRTUAL_START ? 0 : lineEnd(content, s.end);
    const end = endDirective.value === VIRTUAL_END ? content.length : lineStart(content, e.start);
    if (end <= start) continue;
    candidates.push({ start, end });
  }
  const filtered = filterCandidates(content, candidates, contains);
  if (filtered.length !== 1) throw new Error(filtered.length === 0 ? 'No range candidate matched START + END + CONTAINS' : `Range is ambiguous (${filtered.length} matches)`);
  return { replaceStart: filtered[0].start, replaceEnd: filtered[0].end };
}

export function resolveReplaceBlock(content: string, directives: Record<string, string> = {}): ResolvedRange {
  const start = directives.START?.trim();
  if (!start || start === VIRTUAL_START || start === VIRTUAL_END) throw new Error('replace_block requires non-virtual START directive');
  const matches = findAllOccurrences(content, start);
  if (matches.length !== 1) throw new Error(matches.length === 0 ? `START anchor not found: "${start}"` : `START anchor is ambiguous (${matches.length} matches)`);
  const brace = findBraceRangeFromSelection(content, matches[0].start);
  if (!brace.match) throw new Error(formatBraceScanError(brace.error!));
  return { replaceStart: brace.match.openIndex, replaceEnd: brace.match.closeIndex + 1 };
}
