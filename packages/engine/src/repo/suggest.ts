import * as fs from 'fs';
import * as path from 'path';
import { HEAVY_DIR_NAMES, HEAVY_FILE_COUNT_THRESHOLD } from '@inscribe/shared';
import { listTopLevelFolders } from './topLevel';

const heavyDirNameSet = new Set<string>(HEAVY_DIR_NAMES as readonly string[]);

function countFilesWithThreshold(dir: string, threshold: number): number {
  let count = 0;
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (count >= threshold) break;
    const fullPath = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) {
      continue;
    }
    if (entry.isDirectory()) {
      count += countFilesWithThreshold(fullPath, threshold - count);
    } else if (entry.isFile()) {
      count += 1;
    }
  }

  return count;
}

export function computeSuggestedExcludes(repoRoot: string): string[] {
  const topLevel = listTopLevelFolders(repoRoot);
  const suggested: string[] = [];

  for (const folder of topLevel) {
    const name = folder.endsWith('/') ? folder.slice(0, -1) : folder;
    if (heavyDirNameSet.has(name)) {
      suggested.push(folder);
      continue;
    }

    const fullPath = path.join(repoRoot, folder);
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
      const fileCount = countFilesWithThreshold(fullPath, HEAVY_FILE_COUNT_THRESHOLD);
      if (fileCount >= HEAVY_FILE_COUNT_THRESHOLD) {
        suggested.push(folder);
      }
    }
  }

  return suggested.sort();
}

export function computeDefaultScope(repoRoot: string): { scope: string[]; suggested: string[]; topLevel: string[] } {
  const topLevel = listTopLevelFolders(repoRoot);
  const suggested = computeSuggestedExcludes(repoRoot);
  const suggestedSet = new Set(suggested);
  const scope = topLevel.filter(folder => !suggestedSet.has(folder)).sort();

  return { scope, suggested, topLevel };
}
