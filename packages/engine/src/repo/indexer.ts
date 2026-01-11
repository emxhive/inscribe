import * as fs from 'fs';
import * as path from 'path';
import { getEffectiveIgnoreMatchers, matchIgnoredPath, type IgnoreMatcher } from './ignoreRules';
import { normalizeRelativePath } from './pathing';
import { getOrCreateScope, setScopeState } from './scopeStore';
import { setIndexStatusComplete, setIndexStatusError, setIndexStatusRunning } from './statusStore';

export function indexRepository(repoRoot: string, providedScope?: string[]): string[] {
  const scopeState = providedScope
    ? setScopeState(repoRoot, providedScope)
    : getOrCreateScope(repoRoot);

  const scope = scopeState.scope;
  const ignoreMatcher = getEffectiveIgnoreMatchers(repoRoot);

  setIndexStatusRunning(repoRoot);

  const files: string[] = [];

  try {
    for (const root of scope) {
      const rootPath = path.join(repoRoot, root);
      if (fs.existsSync(rootPath) && fs.statSync(rootPath).isDirectory()) {
        collectFiles(rootPath, repoRoot, files, ignoreMatcher);
      }
    }

    files.sort();
    setIndexStatusComplete(repoRoot, files.length);
    setScopeState(repoRoot, scope, { lastIndexedCount: files.length });
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
    if (entry.isDirectory()) {
      const ignoreMatch = matchIgnoredPath(relativePath, ignoreMatcher, { isDirectory: true });
      if (ignoreMatch) {
        continue;
      }
      collectFiles(fullPath, repoRoot, files, ignoreMatcher);
    } else if (entry.isFile()) {
      const ignoreMatch = matchIgnoredPath(relativePath, ignoreMatcher);
      if (!ignoreMatch) {
        files.push(relativePath);
      }
    }
  }
}
