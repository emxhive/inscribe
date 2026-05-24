import { findAllOccurrences } from '../util/textSearch';

export const VIRTUAL_START = '::START_OF_FILE';
export const VIRTUAL_END = '::END_OF_FILE';

export function lineStart(content: string, idx: number): number {
  const n = content.lastIndexOf('\n', Math.max(0, idx - 1));
  return n === -1 ? 0 : n + 1;
}

export function lineEnd(content: string, idx: number): number {
  const n = content.indexOf('\n', idx);
  return n === -1 ? content.length : n + 1;
}

export function resolveAnchors(content: string, value: string): { start: number; end: number }[] {
  if (value === VIRTUAL_START) return [{ start: 0, end: 0 }];
  if (value === VIRTUAL_END) return [{ start: content.length, end: content.length }];
  return findAllOccurrences(content, value);
}

export function filterCandidates(content: string, candidates: { start: number; end: number }[], contains: string[]): { start: number; end: number }[] {
  if (contains.length === 0) return candidates;
  return candidates.filter((c) => {
    const text = content.slice(c.start, c.end);
    return contains.every((v) => text.includes(v));
  });
}

export function formatAnchorNotFound(name: string, value: string): string {
  return `${name} anchor not found: "${value}"`;
}

export function formatAnchorAmbiguous(name: string, count: number): string {
  return `${name} anchor is ambiguous (${count} matches)`;
}

export function formatRangeAmbiguous(count: number): string {
  return `Range is ambiguous (${count} matches)`;
}

export function formatNoCandidateMatched(): string {
  return 'No range candidate matched START + END + CONTAINS';
}
