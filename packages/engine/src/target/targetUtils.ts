import { findAllOccurrences } from '../util/textSearch';

export { findAllOccurrences };

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

export function resolveLineLevelAnchors(
  content: string,
  value: string,
  strategy: 'equals' | 'contains',
): { start: number; end: number }[] {
  if (value === VIRTUAL_START) return [{ start: 0, end: 0 }];
  if (value === VIRTUAL_END) return [{ start: content.length, end: content.length }];

  const lines = content.split('\n');
  const matches: { start: number; end: number }[] = [];
  let currentPos = 0;

  const targetValue = value.trim();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const nextPos = currentPos + line.length + (i < lines.length - 1 ? 1 : 0);

    if (strategy === 'equals') {
      if (line.trim() === targetValue) {
        matches.push({ start: currentPos, end: currentPos + line.length });
      }
    } else {
      if (line.includes(value)) {
        matches.push({ start: currentPos, end: currentPos + line.length });
      }
    }

    currentPos = nextPos;
  }

  return matches;
}

export interface BoundaryResolution {
  matches: { start: number; end: number; value: string }[];
  name: string;
  value: string;
  isVirtual: boolean;
  strategy: 'equals' | 'contains';
}

export function resolveBoundarySelector(
  content: string,
  directives: Record<string, string>,
  side: 'START' | 'END',
): BoundaryResolution {
  const containsKey = `${side}_LINE_CONTAINS`;
  const equalsKey = `${side}_LINE_EQUALS`;
  const containsValue = directives[containsKey];
  const equalsValue = directives[equalsKey];

  if (containsValue !== undefined && equalsValue !== undefined) {
    throw new Error(`Cannot use both ${containsKey} and ${equalsKey}`);
  }

  if (containsValue === undefined && equalsValue === undefined) {
    throw new Error(`Missing required ${side} boundary selector (${containsKey} or ${equalsKey})`);
  }

  const name = containsValue !== undefined ? containsKey : equalsKey;
  const value = (containsValue ?? equalsValue)!;
  const strategy = containsValue !== undefined ? 'contains' : 'equals';
  const isVirtual = value === VIRTUAL_START || value === VIRTUAL_END;
  const matches = resolveLineLevelAnchors(content, value, strategy).map(m => ({ ...m, value }));

  return { matches, name, value, isVirtual, strategy };
}

export function filterCandidates(
  content: string,
  candidates: { start: number; end: number }[],
  contains: string[],
  lineContainsAll: string[][] = [],
): { start: number; end: number }[] {
  if (contains.length === 0 && lineContainsAll.length === 0) return candidates;
  return candidates.filter((c) => {
    const text = content.slice(c.start, c.end);
    const lines = lineContainsAll.length > 0 ? text.split(/\r\n|\n|\r/) : [];
    return contains.every((v) => text.includes(v)) &&
      lineContainsAll.every((fragments) => lines.some((line) => fragments.every((fragment) => line.includes(fragment))));
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
  return 'No range candidate matched boundary selectors and RANGE_CONTAINS filters';
}
