import * as fs from 'fs';
import { IGNORED_PATHS } from '@inscribe/shared';
import { normalizePrefix } from './pathing';

const normalizedDefaultIgnores = Array.from(IGNORED_PATHS).map((p: string) => normalizePrefix(p));

function isDefaultIgnored(folderName: string): boolean {
  const normalized = normalizePrefix(folderName);
  return normalizedDefaultIgnores.some(defaultIgnored =>
    normalized.startsWith(defaultIgnored)
  );
}

export function listTopLevelFolders(repoRoot: string): string[] {
  if (!fs.existsSync(repoRoot)) {
    return [];
  }

  const entries = fs.readdirSync(repoRoot, { withFileTypes: true });
  const folders = entries
    .filter((entry: fs.Dirent) => entry.isDirectory())
    .map((entry: fs.Dirent) => normalizePrefix(entry.name))
    .filter((name: string) => !isDefaultIgnored(name));

  return folders.sort();
}
