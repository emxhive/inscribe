import * as fs from 'fs';
import * as path from 'path';
import { IGNORED_PATHS, INSCRIBE_IGNORE_FILE } from '@shared';
import type { IgnoreRules } from '@shared';
import { normalizePrefix } from './pathing';

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
    .map((p: string) => normalizePrefix(p));

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
  const defaults = Array.from(IGNORED_PATHS).map((p: string) => normalizePrefix(p));
  const fileIgnores = readIgnoreRules(repoRoot).entries.map((p: string) => normalizePrefix(p));
  return Array.from(new Set([...defaults, ...fileIgnores])).sort();
}
