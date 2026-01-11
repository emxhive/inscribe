import * as fs from 'fs';
import * as path from 'path';
import { IGNORED_PATHS, INSCRIBE_IGNORE_FILE } from '@inscribe/shared';
import type { IgnoreRules } from '@inscribe/shared';
import { ensureTrailingSlash, normalizePrefix, normalizeRelativePath } from './pathing';
import picomatch from 'picomatch';

export type IgnoreMatcher = {
  prefixes: string[];
  globs: string[];
};

const GLOB_CHARACTER_PATTERN = /[*?\[\]]/;

function isGlobPattern(entry: string): boolean {
  return GLOB_CHARACTER_PATTERN.test(entry);
}

function normalizeIgnoreEntry(entry: string): { type: 'prefix' | 'glob'; value: string } {
  if (isGlobPattern(entry)) {
    return { type: 'glob', value: normalizeRelativePath(entry) };
  }
  return { type: 'prefix', value: normalizePrefix(entry) };
}

function splitIgnoreEntries(entries: string[]): IgnoreMatcher {
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

export function readIgnoreRules(repoRoot: string): IgnoreRules {
  const ignorePath = path.join(repoRoot, INSCRIBE_IGNORE_FILE);
  if (!fs.existsSync(ignorePath)) {
    return { entries: [], source: 'none', path: ignorePath };
  }

  const content = fs.readFileSync(ignorePath, 'utf-8');
  const entries = content
    .split('\n')
    .map((line: string) => line.trim())
    .filter((line: string) => line.length > 0 && !line.startsWith('#'))
    .map((p: string) => normalizeIgnoreEntry(p).value);

  const unique = Array.from(new Set(entries)).sort();

  return {
    entries: unique,
    source: 'file',
    path: ignorePath,
  };
}

export function writeIgnoreFile(repoRoot: string, content: string): { success: boolean; error?: string } {
  try {
    fs.mkdirSync(repoRoot, { recursive: true });
    const targetPath = path.join(repoRoot, INSCRIBE_IGNORE_FILE);
    const tempPath = `${targetPath}.tmp`;
    fs.writeFileSync(tempPath, content);
    fs.renameSync(tempPath, targetPath);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export function getEffectiveIgnorePrefixes(repoRoot: string): string[] {
  const defaults = Array.from(IGNORED_PATHS);
  const fileIgnores = readIgnoreRules(repoRoot).entries;
  return splitIgnoreEntries([...defaults, ...fileIgnores]).prefixes;
}

export function getEffectiveIgnoreMatchers(repoRoot: string): IgnoreMatcher {
  const defaults = Array.from(IGNORED_PATHS);
  const fileIgnores = readIgnoreRules(repoRoot).entries;
  return splitIgnoreEntries([...defaults, ...fileIgnores]);
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
