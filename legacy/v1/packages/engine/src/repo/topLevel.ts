import * as fs from 'fs';
import { normalizePrefix } from './pathing';
import { getEffectiveIgnoreMatchers, matchIgnoredPath } from './ignoreRules';

export function listTopLevelFolders(repoRoot: string): string[] {
  if (!fs.existsSync(repoRoot)) {
    return [];
  }

  const entries = fs.readdirSync(repoRoot, { withFileTypes: true });
  const ignoreMatcher = getEffectiveIgnoreMatchers(repoRoot);
  const folders = entries
    .filter((entry: fs.Dirent) => entry.isDirectory())
    .map((entry: fs.Dirent) => normalizePrefix(entry.name))
    .filter((name: string) => !matchIgnoredPath(name, ignoreMatcher, { isDirectory: true }));

  return folders.sort();
}
