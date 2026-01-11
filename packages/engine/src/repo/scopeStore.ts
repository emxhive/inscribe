import * as fs from 'fs';
import * as path from 'path';
import type { ScopeState } from '@inscribe/shared';
import { computeDefaultScope } from './suggest';
import { listTopLevelFolders } from './topLevel';
import { normalizePrefix } from './pathing';
import { getStorePath } from './storePath';
import { repoKey } from './statusStore';

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

function isAccessibleRepoRoot(repoRoot: string): boolean {
  try {
    const stats = fs.statSync(repoRoot);
    if (!stats.isDirectory()) {
      return false;
    }
    fs.accessSync(repoRoot, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
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

export function getOrCreateScope(repoRoot: string): ScopeState {
  const existing = getScopeState(repoRoot);
  if (existing && existing.scope && existing.scope.length > 0) {
    return existing;
  }

  const { scope, suggested } = computeDefaultScope(repoRoot);
  return recordScopeState(repoRoot, scope, { lastSuggested: suggested });
}

export function getLastVisitedRepo(): string | null {
  const store = readScopeStore();
  const entries = Object.values(store)
    .filter((state): state is ScopeState => Boolean(state && state.repoRoot))
    .map((state) => ({
      repoRoot: state.repoRoot,
      updatedAt: Date.parse(state.updatedAt) || 0,
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt);

  for (const entry of entries) {
    if (isAccessibleRepoRoot(entry.repoRoot)) {
      return entry.repoRoot;
    }
  }

  return null;
}
