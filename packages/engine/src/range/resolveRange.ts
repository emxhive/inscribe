import { findAllOccurrences, MatchRange } from '../util/textSearch';

export interface ResolvedRangeDirectiveShape { startDirective: { key: 'START'; value: string }; endDirective: { key: 'END'; value: string } | null; contains: string[]; }
export interface ResolvedRange { startDirective: { key: 'START'; value: string }; endDirective: { key: 'END'; value: string } | null; startMatch: MatchRange; endMatch: MatchRange | null; replaceStart: number; replaceEnd: number; }

export function resolveRangeDirectiveShape(directives: Record<string, string> = {}): ResolvedRangeDirectiveShape {
  const start = directives.START?.trim(); const end = directives.END?.trim(); const contains = (directives.CONTAINS ?? '').split('\n').map(v => v.trim()).filter(Boolean);
  if (!start) throw new Error('Missing required START directive');
  return { startDirective: { key: 'START', value: start }, endDirective: end ? { key: 'END', value: end } : null, contains };
}

export function resolveRange(content: string, directives: Record<string, string> = {}): ResolvedRange {
  const { startDirective, endDirective, contains } = resolveRangeDirectiveShape(directives);
  const startMatches = findAllOccurrences(content, startDirective.value);
  if (startMatches.length !== 1) throw new Error(startMatches.length === 0 ? `START anchor not found: "${startDirective.value}"` : `START anchor is ambiguous (${startMatches.length} matches)`);
  const startMatch = startMatches[0];
  if (!endDirective) {
    const lineStart = getLineStart(content, startMatch.start);
    const lineEnd = getLineEnd(content, startMatch.end);
    return { startDirective, endDirective: null, startMatch, endMatch: null, replaceStart: lineStart, replaceEnd: lineEnd };
  }
  const endMatches = findAllOccurrences(content, endDirective.value).filter(m => m.start >= startMatch.end);
  if (endMatches.length !== 1) throw new Error(endMatches.length === 0 ? `END anchor not found after START: "${endDirective.value}"` : `END anchor is ambiguous (${endMatches.length} matches after START)`);
  const endMatch = endMatches[0];
  const bounded = content.slice(startMatch.start, endMatch.end);
  if (contains.length > 0 && !contains.every(v => bounded.includes(v))) throw new Error('No range candidate matched START + END + CONTAINS');
  return { startDirective, endDirective, startMatch, endMatch, replaceStart: getLineStart(content, startMatch.start), replaceEnd: getLineEnd(content, endMatch.end) };
}

function getLineStart(content: string, index: number): number { const newline = content.lastIndexOf('\n', index - 1); return newline === -1 ? 0 : newline + 1; }
function getLineEnd(content: string, index: number): number { const newline = content.indexOf('\n', index); return newline === -1 ? content.length : newline + 1; }
