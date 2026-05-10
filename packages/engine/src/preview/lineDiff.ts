export interface LineDiffPart {
  value: string;
  added?: boolean;
  removed?: boolean;
}

type DiffLinesFn = (oldText: string, newText: string) => LineDiffPart[];

let cachedExternal: DiffLinesFn | null | undefined;

/**
 * Prefer vetted external diff library when available, while retaining a deterministic
 * built-in fallback for restricted environments.
 */
export function diffLinesStable(oldText: string, newText: string): LineDiffPart[] {
  const external = getExternalDiffLines();
  if (external) {
    return external(oldText, newText);
  }
  return diffByLinesFallback(oldText, newText);
}

function getExternalDiffLines(): DiffLinesFn | null {
  if (cachedExternal !== undefined) return cachedExternal;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('diff') as { diffLines?: DiffLinesFn };
    cachedExternal = typeof mod.diffLines === 'function' ? mod.diffLines : null;
  } catch {
    cachedExternal = null;
  }
  return cachedExternal;
}

function splitLinesWithNewline(text: string): string[] {
  if (!text) return [];
  const lines = text.match(/[^\n]*\n|[^\n]+$/g);
  return lines ?? [];
}

function diffByLinesFallback(oldText: string, newText: string): LineDiffPart[] {
  const a = splitLinesWithNewline(oldText);
  const b = splitLinesWithNewline(newText);
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const parts: LineDiffPart[] = [];
  let i = 0;
  let j = 0;
  const push = (piece: LineDiffPart) => {
    const last = parts[parts.length - 1];
    if (last && last.added === piece.added && last.removed === piece.removed) {
      last.value += piece.value;
    } else {
      parts.push({ ...piece });
    }
  };
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      push({ value: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      push({ value: a[i], removed: true });
      i++;
    } else {
      push({ value: b[j], added: true });
      j++;
    }
  }
  while (i < a.length) push({ value: a[i++], removed: true });
  while (j < b.length) push({ value: b[j++], added: true });
  return parts;
}
