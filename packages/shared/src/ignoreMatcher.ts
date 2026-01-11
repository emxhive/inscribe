import picomatch from 'picomatch/browser';

export type IgnoreMatcher = {
  prefixes: string[];
  globs: string[];
};

const GLOB_CHARACTER_PATTERN = /[*?\[\]]/;

export function normalizeRelativePath(input: string): string {
  const trimmed = input.trim().replace(/\\/g, '/').replace(/^\.\/+/, '');
  return trimmed.replace(/\/+/g, '/');
}

export function ensureTrailingSlash(input: string): string {
  return input.endsWith('/') ? input : `${input}/`;
}

export function normalizePrefix(input: string): string {
  return ensureTrailingSlash(normalizeRelativePath(input));
}

function isGlobPattern(entry: string): boolean {
  return GLOB_CHARACTER_PATTERN.test(entry);
}

function normalizeIgnoreEntry(entry: string): { type: 'prefix' | 'glob'; value: string } {
  if (isGlobPattern(entry)) {
    return { type: 'glob', value: normalizeRelativePath(entry) };
  }
  return { type: 'prefix', value: normalizePrefix(entry) };
}

export function buildIgnoreMatcher(entries: string[]): IgnoreMatcher {
  const prefixes: string[] = [];
  const globs: string[] = [];

  for (const entry of entries) {
    const normalized = normalizeIgnoreEntry(entry);
    if (normalized.type === 'glob') {
      globs.push(normalized.value);
    } else {
      prefixes.push(normalized.value);
    }
  }

  return {
    prefixes: Array.from(new Set(prefixes)).sort(),
    globs: Array.from(new Set(globs)).sort(),
  };
}

export function matchIgnoredPath(
  relativePath: string,
  ignoreMatcher: IgnoreMatcher,
  options?: { isDirectory?: boolean }
): string | null {
  const normalizedPath = normalizeRelativePath(relativePath);
  const normalizedDir = ensureTrailingSlash(normalizedPath);
  const prefixTarget = options?.isDirectory ? normalizedDir : normalizedPath;

  const prefixMatch = ignoreMatcher.prefixes.find(prefix => prefixTarget.startsWith(prefix));
  if (prefixMatch) {
    return prefixMatch;
  }

  for (const glob of ignoreMatcher.globs) {
    const isMatch = picomatch(glob, { dot: true });
    if (isMatch(normalizedPath) || (options?.isDirectory && isMatch(normalizedDir))) {
      return glob;
    }
  }

  return null;
}
