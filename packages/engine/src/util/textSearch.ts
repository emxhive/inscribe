export interface MatchRange {
  start: number;
  end: number;
}

interface NormalizedLine {
  normalized: string;
  indexMap: number[];
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, '');
}

function normalizeLine(line: string): NormalizedLine {
  const indexMap: number[] = [];
  let normalized = '';
  for (let i = 0; i < line.length; i++) {
    if (/\s/.test(line[i])) {
      continue;
    }
    indexMap.push(i);
    normalized += line[i];
  }
  return { normalized, indexMap };
}

function findDirectMatches(content: string, search: string): MatchRange[] {
  const matches: MatchRange[] = [];
  let pos = content.indexOf(search);
  while (pos !== -1) {
    matches.push({ start: pos, end: pos + search.length });
    pos = content.indexOf(search, pos + 1);
  }
  return matches;
}

function findWhitespaceInsensitiveMatches(content: string, search: string): MatchRange[] {
  const normalizedSearch = normalizeWhitespace(search);
  if (!normalizedSearch) {
    return [];
  }

  const matches: MatchRange[] = [];
  let lineStart = 0;

  while (lineStart <= content.length) {
    let lineEnd = content.indexOf('\n', lineStart);
    if (lineEnd === -1) {
      lineEnd = content.length;
    }
    const line = content.slice(lineStart, lineEnd);
    const { normalized, indexMap } = normalizeLine(line);

    if (normalized.length >= normalizedSearch.length) {
      let pos = normalized.indexOf(normalizedSearch);
      while (pos !== -1) {
        const startIndex = indexMap[pos];
        const endIndex = indexMap[pos + normalizedSearch.length - 1];
        if (startIndex !== undefined && endIndex !== undefined) {
          matches.push({
            start: lineStart + startIndex,
            end: lineStart + endIndex + 1,
          });
        }
        pos = normalized.indexOf(normalizedSearch, pos + 1);
      }
    }

    if (lineEnd === content.length) {
      break;
    }
    lineStart = lineEnd + 1;
  }

  return matches;
}

export function findAllOccurrences(content: string, search: string): MatchRange[] {
  if (!search) {
    return [];
  }
  const directMatches = findDirectMatches(content, search);
  if (directMatches.length > 0) {
    return directMatches;
  }
  return findWhitespaceInsensitiveMatches(content, search);
}
