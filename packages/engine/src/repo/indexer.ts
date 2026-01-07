import * as fs from 'fs';
import * as path from 'path';
import { getEffectiveIgnorePrefixes } from './ignoreRules';
import { ensureTrailingSlash, normalizeRelativePath } from './pathing';
import { getOrCreateScope, setScopeState } from './scopeStore';
import { setIndexStatusComplete, setIndexStatusError, setIndexStatusRunning } from './statusStore';

export function indexRepository(repoRoot: string, providedScope?: string[]): string[] {
  const scopeState = providedScope
    ? setScopeState(repoRoot, providedScope)
    : getOrCreateScope(repoRoot);

  const scope = scopeState.scope;
  const ignores = getEffectiveIgnorePrefixes(repoRoot);

  setIndexStatusRunning(repoRoot);

  const files: string[] = [];

  try {
    for (const root of scope) {
      const rootPath = path.join(repoRoot, root);
      if (fs.existsSync(rootPath) && fs.statSync(rootPath).isDirectory()) {
        collectFiles(rootPath, repoRoot, files, ignores);
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
 * Recursively collect files under the given directory while skipping ignored prefixes and symlinks.
 */
function collectFiles(
  dir: string,
  repoRoot: string,
  files: string[],
  ignores: string[]
): void {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = normalizeRelativePath(path.relative(repoRoot, fullPath));

    if (entry.isSymbolicLink()) {
      continue;
    }
    if (entry.isDirectory()) {
      const relativeDir = ensureTrailingSlash(relativePath);
      const isIgnoredDir = ignores.some(prefix => relativeDir.startsWith(prefix));
      if (isIgnoredDir) {
        continue;
      }
      collectFiles(fullPath, repoRoot, files, ignores);
    } else if (entry.isFile()) {
      const isIgnoredFile = ignores.some(prefix => relativePath.startsWith(prefix));
      if (!isIgnoredFile) {
        files.push(relativePath);
      }
    }
  }
}
