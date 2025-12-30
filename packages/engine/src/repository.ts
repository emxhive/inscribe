import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import {
  HEAVY_DIR_NAMES,
  HEAVY_FILE_COUNT_THRESHOLD,
  IGNORED_PATHS,
  INSCRIBE_IGNORE_FILE,
  SCOPE_STORE_FILE,
} from '@inscribe/shared';
import type { IgnoreRules, IndexStatus, ScopeState } from '@inscribe/shared';

const indexStatusMap = new Map<string, IndexStatus & { count?: number }>();
const heavyDirNameSet = new Set<string>(HEAVY_DIR_NAMES as readonly string[]);
const normalizedDefaultIgnores = Array.from(IGNORED_PATHS).map(normalizePrefix);

function normalizeRelativePath(input: string): string {
  const trimmed = input.trim().replace(/\\/g, '/').replace(/^\.\/+/, '');
  return trimmed.replace(/\/+/g, '/');
}

function ensureTrailingSlash(input: string): string {
  return input.endsWith('/') ? input : `${input}/`;
}

function normalizePrefix(input: string): string {
  return ensureTrailingSlash(normalizeRelativePath(input));
}

function repoKey(repoRoot: string): string {
  return crypto.createHash('sha256').update(path.resolve(repoRoot)).digest('hex');
}

function getUserDataPath(): string {
  if (process.env.INSCRIBE_USER_DATA) {
    return process.env.INSCRIBE_USER_DATA;
  }

  try {
    const electron = require('electron') as typeof import('electron');
    if (electron?.app?.getPath) {
      return electron.app.getPath('userData');
    }
  } catch {
    // Ignore if electron is not available (e.g., during tests)
  }

  return path.join(os.tmpdir(), 'inscribe-user-data');
}

function getStorePath(): string {
  const baseDir = path.join(getUserDataPath(), '.inscribe');
  fs.mkdirSync(baseDir, { recursive: true });
  return path.join(baseDir, SCOPE_STORE_FILE);
}

function readScopeStore(): Record<string, ScopeState> {
  const storePath = getStorePath();
  if (!fs.existsSync(storePath)) {
    return {};
  }

  try {
    const raw = fs.readFileSync(storePath, 'utf-8');
    const parsed = JSON.parse(raw);
    return parsed || {};
  } catch {
    return {};
  }
}

function writeScopeStore(store: Record<string, ScopeState>): void {
  const storePath = getStorePath();
  const tempPath = `${storePath}.tmp`;
  try {
    fs.writeFileSync(tempPath, JSON.stringify(store, null, 2));
    fs.renameSync(tempPath, storePath);
  } catch (error) {
    try {
      if (fs.existsSync(tempPath)) {
        fs.rmSync(tempPath, { force: true });
      }
    } catch {
      // ignore cleanup errors
    }
    throw error;
  }
}

function normalizeScopeList(scope: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const entry of scope) {
    const normalized = normalizePrefix(entry);
    if (!seen.has(normalized)) {
      seen.add(normalized);
      result.push(normalized);
    }
  }
  return result.sort();
}

function recordScopeState(
  repoRoot: string,
  scope: string[],
  extras?: Partial<Omit<ScopeState, 'repoRoot' | 'scope' | 'updatedAt'>>
): ScopeState {
  const store = readScopeStore();
  const key = repoKey(repoRoot);
  const existing = store[key];

  const next: ScopeState = {
    repoRoot: path.resolve(repoRoot),
    scope: normalizeScopeList(scope),
    lastSuggested: extras?.lastSuggested ?? existing?.lastSuggested,
    lastIndexedCount: extras?.lastIndexedCount ?? existing?.lastIndexedCount,
    updatedAt: new Date().toISOString(),
  };

  store[key] = next;
  writeScopeStore(store);
  return next;
}

function normalizeScopeForRepo(repoRoot: string, scope: string[]): string[] {
  const topLevelSet = new Set(listTopLevelFolders(repoRoot));
  const normalized = normalizeScopeList(scope);
  if (topLevelSet.size === 0) {
    return normalized;
  }
  return normalized.filter(entry => topLevelSet.has(entry));
}

export function getScopeState(repoRoot: string): ScopeState | undefined {
  const store = readScopeStore();
  return store[repoKey(repoRoot)];
}

export function setScopeState(
  repoRoot: string,
  scope: string[],
  extras?: Partial<Omit<ScopeState, 'repoRoot' | 'scope' | 'updatedAt'>>
): ScopeState {
  const filteredScope = normalizeScopeForRepo(repoRoot, scope);
  return recordScopeState(repoRoot, filteredScope, extras);
}

export function readIgnoreRules(repoRoot: string): IgnoreRules {
  const ignorePath = path.join(repoRoot, INSCRIBE_IGNORE_FILE);
  if (!fs.existsSync(ignorePath)) {
    return { entries: [], source: 'none', path: ignorePath };
  }

  const content = fs.readFileSync(ignorePath, 'utf-8');
  const entries = content
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.startsWith('#'))
    .map(normalizePrefix);

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
  const defaults = Array.from(IGNORED_PATHS).map(normalizePrefix);
  const fileIgnores = readIgnoreRules(repoRoot).entries.map(normalizePrefix);
  return Array.from(new Set([...defaults, ...fileIgnores])).sort();
}

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
    .filter(entry => entry.isDirectory())
    .map(entry => normalizePrefix(entry.name))
    .filter(name => !isDefaultIgnored(name));

  return folders.sort();
}

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

export function getOrCreateScope(repoRoot: string): ScopeState {
  const existing = getScopeState(repoRoot);
  if (existing && existing.scope && existing.scope.length > 0) {
    return existing;
  }

  const { scope, suggested } = computeDefaultScope(repoRoot);
  return recordScopeState(repoRoot, scope, { lastSuggested: suggested });
}

export function indexRepository(repoRoot: string, providedScope?: string[]): string[] {
  const scopeState = providedScope
    ? setScopeState(repoRoot, providedScope)
    : getOrCreateScope(repoRoot);

  const scope = scopeState.scope;
  const ignores = getEffectiveIgnorePrefixes(repoRoot);
  const key = repoKey(repoRoot);

  indexStatusMap.set(key, { state: 'running' });

  const files: string[] = [];

  try {
    for (const root of scope) {
      const rootPath = path.join(repoRoot, root);
      if (fs.existsSync(rootPath) && fs.statSync(rootPath).isDirectory()) {
        collectFiles(rootPath, repoRoot, files, ignores);
      }
    }

    files.sort();
    indexStatusMap.set(key, { state: 'complete', count: files.length });
    setScopeState(repoRoot, scope, { lastIndexedCount: files.length });
    return files.map(file => normalizeRelativePath(file));
  } catch (error) {
    indexStatusMap.set(key, {
      state: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    return [];
  }
}

export function getIndexStatus(repoRoot: string): IndexStatus {
  return indexStatusMap.get(repoKey(repoRoot)) ?? { state: 'idle' };
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
