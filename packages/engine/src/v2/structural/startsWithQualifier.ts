function normalizeLineEndings(str: string): string {
  return str.replace(/\r\n|\r/g, '\n');
}

export function dedent(str: string): string {
  const normalized = normalizeLineEndings(str);
  let lines = normalized.split('\n');

  // Strip leading blank lines
  while (lines.length > 0 && lines[0].trim() === '') {
    lines.shift();
  }
  // Strip trailing blank lines
  while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
    lines.pop();
  }

  if (lines.length === 0) {
    return '';
  }

  // Find minimum indentation of non-empty lines
  let minIndent = Infinity;
  for (const line of lines) {
    if (line.trim() === '') {
      continue;
    }
    const match = line.match(/^[ \t]*/);
    const indentLength = match ? match[0].length : 0;
    if (indentLength < minIndent) {
      minIndent = indentLength;
    }
  }

  if (minIndent === Infinity || minIndent === 0) {
    return lines.join('\n');
  }

  return lines.map((line) => {
    if (line.trim() === '') {
      return '';
    }
    return line.slice(minIndent);
  }).join('\n');
}

export function matchesStartsWith(candidateSource: string, snippet: string): boolean {
  const normalizedCandidate = dedent(candidateSource);
  const normalizedSnippet = dedent(snippet);
  return normalizedCandidate.startsWith(normalizedSnippet);
}
