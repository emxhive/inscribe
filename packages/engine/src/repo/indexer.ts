import * as fs from 'fs';
import * as path from 'path';
import { getEffectiveIgnoreMatchers, matchIgnoredPath, type IgnoreMatcher } from './ignoreRules';
import { INSCRIBE_IGNORE_FILE } from '@inscribe/shared';
import { normalizeRelativePath } from './pathing';
import { setIndexStatusComplete, setIndexStatusError, setIndexStatusRunning } from './statusStore';

export function indexRepository(repoRoot: string): string[] {
  const ignoreMatcher = getEffectiveIgnoreMatchers(repoRoot);

  setIndexStatusRunning(repoRoot);

  const files: string[] = [];

  try {
    collectFiles(repoRoot, repoRoot, files, ignoreMatcher);

    files.sort();
    setIndexStatusComplete(repoRoot, files.length);
    return files.map(file => normalizeRelativePath(file));
  } catch (error) {
    setIndexStatusError(repoRoot, error);
    return [];
  }
}

/**
 * Recursively collect files under the given directory while skipping ignored prefixes/globs and symlinks.
 */
function collectFiles(
  dir: string,
  repoRoot: string,
  files: string[],
  ignoreMatcher: IgnoreMatcher
): void {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = normalizeRelativePath(path.relative(repoRoot, fullPath));

    if (entry.isSymbolicLink()) {
      continue;
    }
    if (path.resolve(fullPath) === path.resolve(repoRoot)) {
      continue;
    }
    if (entry.isDirectory()) {
      const ignoreMatch = matchIgnoredPath(relativePath, ignoreMatcher, { isDirectory: true });
      if (ignoreMatch) {
        continue;
      }
      collectFiles(fullPath, repoRoot, files, ignoreMatcher);
    } else if (entry.isFile()) {
      if (entry.name === INSCRIBE_IGNORE_FILE) {
        continue;
      }
      const ignoreMatch = matchIgnoredPath(relativePath, ignoreMatcher);
      if (!ignoreMatch) {
        files.push(relativePath);
      }
    }
  }
}
