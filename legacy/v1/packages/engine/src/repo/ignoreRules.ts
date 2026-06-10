import * as fs from 'fs';
import * as path from 'path';
import { IGNORED_PATHS, INSCRIBE_IGNORE_FILE } from '@inscribe/shared';
import type { IgnoreRules } from '@inscribe/shared';
import { ensureTrailingSlash, normalizePrefix, normalizeRelativePath } from './pathing';
import picomatch from 'picomatch';

export type IgnoreMatcher = {
  prefixes: string[];
  globs: string[];
  unignorePrefixes: string[];
  unignoreGlobs: string[];
};

const GLOB_CHARACTER_PATTERN = /[*?\[\]]/;

function isGlobPattern(entry: string): boolean {
  return GLOB_CHARACTER_PATTERN.test(entry);
}

function normalizeIgnoreEntry(entry: string): { type: 'prefix' | 'glob'; value: string; negated: boolean } {
  const trimmed = entry.trim();
  const negated = trimmed.startsWith('!');
  const rawPattern = negated ? trimmed.slice(1).trim() : trimmed;
  const value = isGlobPattern(rawPattern) ? normalizeRelativePath(rawPattern) : normalizePrefix(rawPattern);

  return {
    type: isGlobPattern(rawPattern) ? 'glob' : 'prefix',
    value: negated ? `!${value}` : value,
    negated,
  };
}

function splitIgnoreValue(entry: string): { type: 'prefix' | 'glob'; value: string; negated: boolean } {
  const negated = entry.startsWith('!');
  const value = negated ? entry.slice(1) : entry;
  return {
    type: isGlobPattern(value) ? 'glob' : 'prefix',
    value,
    negated,
  };
}

function isMeaningfulIgnoreLine(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length === 0 || trimmed.startsWith('#')) {
    return false;
  }
  return trimmed !== '!';
}

function splitIgnoreEntries(entries: string[]): IgnoreMatcher {
  const prefixes: string[] = [];
  const globs: string[] = [];
  const unignorePrefixes: string[] = [];
  const unignoreGlobs: string[] = [];

  for (const entry of entries) {
    const normalized = splitIgnoreValue(entry);
    if (normalized.type === 'glob') {
      (normalized.negated ? unignoreGlobs : globs).push(normalized.value);
    } else {
      (normalized.negated ? unignorePrefixes : prefixes).push(normalized.value);
    }
  }

  return {
    prefixes: Array.from(new Set(prefixes)).sort(),
    globs: Array.from(new Set(globs)).sort(),
    unignorePrefixes: Array.from(new Set(unignorePrefixes)).sort(),
    unignoreGlobs: Array.from(new Set(unignoreGlobs)).sort(),
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
    .filter(isMeaningfulIgnoreLine)
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

  const unignorePrefixMatch = findPrefixMatch(normalizedPath, prefixTarget, ignoreMatcher.unignorePrefixes);
  if (unignorePrefixMatch) {
    return null;
  }

  const unignoreGlobMatch = findGlobMatch(normalizedPath, normalizedDir, ignoreMatcher.unignoreGlobs, options);
  if (unignoreGlobMatch) {
    return null;
  }

  const prefixMatch = findPrefixMatch(normalizedPath, prefixTarget, ignoreMatcher.prefixes);
  if (prefixMatch) {
    return prefixMatch;
  }

  return findGlobMatch(normalizedPath, normalizedDir, ignoreMatcher.globs, options);
}

function findPrefixMatch(normalizedPath: string, prefixTarget: string, prefixes: string[]): string | null {
  return prefixes.find((prefix) => {
    const normalizedPrefix = prefix.endsWith('/') ? prefix.slice(0, -1) : prefix;
    return prefixTarget === normalizedPrefix || prefixTarget.startsWith(prefix) || normalizedPath === normalizedPrefix;
  }) ?? null;
}

function findGlobMatch(
  normalizedPath: string,
  normalizedDir: string,
  globs: string[],
  options?: { isDirectory?: boolean }
): string | null {
  for (const glob of globs) {
    const isMatch = picomatch(glob, { dot: true });
    if (isMatch(normalizedPath) || (options?.isDirectory && isMatch(normalizedDir))) {
      return glob;
    }
  }
  return null;
}
