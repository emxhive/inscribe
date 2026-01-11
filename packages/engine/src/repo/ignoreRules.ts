import * as fs from 'fs';
import * as path from 'path';
import { IGNORED_PATHS, INSCRIBE_IGNORE_FILE } from '@inscribe/shared';
import type { IgnoreRules } from '@inscribe/shared';
import { normalizePrefix } from './pathing';

export function readIgnoreRules(repoRoot: string): IgnoreRules {
  const ignorePath = path.join(repoRoot, INSCRIBE_IGNORE_FILE);
  if (!fs.existsSync(ignorePath)) {
    return { entries: [], regexEntries: [], source: 'none', path: ignorePath };
  }

  const content = fs.readFileSync(ignorePath, 'utf-8');
  const entries: string[] = [];
  const regexEntries: RegExp[] = [];
  const seenRegex = new Set<string>();

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith('#')) {
      continue;
    }

    if (trimmed.startsWith('regex:')) {
      const pattern = trimmed.slice('regex:'.length).trim();
      if (!pattern) {
        console.warn(`[inscribe] Ignoring empty regex ignore entry in ${ignorePath}`);
        continue;
      }

      try {
        const regex = new RegExp(pattern);
        if (!seenRegex.has(regex.source)) {
          seenRegex.add(regex.source);
          regexEntries.push(regex);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Invalid regex';
        console.warn(
          `[inscribe] Ignoring invalid regex ignore entry "${pattern}" in ${ignorePath}: ${message}`
        );
      }
      continue;
    }

    entries.push(normalizePrefix(trimmed));
  }

  const unique = Array.from(new Set(entries)).sort();
  const sortedRegexEntries = regexEntries
    .slice()
    .sort((a, b) => a.source.localeCompare(b.source));

  return {
    entries: unique,
    regexEntries: sortedRegexEntries,
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
  const defaults = Array.from(IGNORED_PATHS).map((p: string) => normalizePrefix(p));
  const fileIgnores = readIgnoreRules(repoRoot).entries.map((p: string) => normalizePrefix(p));
  return Array.from(new Set([...defaults, ...fileIgnores])).sort();
}

export function getEffectiveIgnoreRules(
  repoRoot: string
): { prefixes: string[]; regexEntries: RegExp[] } {
  const defaults = Array.from(IGNORED_PATHS).map((p: string) => normalizePrefix(p));
  const rules = readIgnoreRules(repoRoot);
  const prefixes = Array.from(new Set([...defaults, ...rules.entries])).sort();
  const regexEntries = rules.regexEntries
    .slice()
    .sort((a, b) => a.source.localeCompare(b.source));
  return { prefixes, regexEntries };
}
