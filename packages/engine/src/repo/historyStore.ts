import * as fs from 'fs';
import * as path from 'path';
import type { HistoryEntry } from '@inscribe/shared';
import { HISTORY_STORE_DIR, INSCRIBE_DIR } from '@inscribe/shared';
import { getUserDataPath } from './storePath';
import { repoKey } from './statusStore';

function getHistoryStorePath(repoRoot: string): string {
  const baseDir = path.join(getUserDataPath(), INSCRIBE_DIR, HISTORY_STORE_DIR);
  fs.mkdirSync(baseDir, { recursive: true });
  return path.join(baseDir, `${repoKey(repoRoot)}.json`);
}

function readHistoryEntries(repoRoot: string): HistoryEntry[] {
  const storePath = getHistoryStorePath(repoRoot);
  if (!fs.existsSync(storePath)) {
    return [];
  }

  try {
    const raw = fs.readFileSync(storePath, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is HistoryEntry => Boolean(entry && entry.protocol === 'v2')).map(normalizeHistoryEntry)
      : [];
  } catch {
    return [];
  }
}
function normalizeHistoryEntry(entry: HistoryEntry): HistoryEntry {
  return {
    ...entry,
    actionId: entry.actionId ?? entry.applyId,
    actionType: entry.actionType ?? 'apply',
  };
}

function writeHistoryEntries(repoRoot: string, entries: HistoryEntry[]): void {
  const storePath = getHistoryStorePath(repoRoot);
  const tempPath = `${storePath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(entries, null, 2));
  fs.renameSync(tempPath, storePath);
}

function mergeHistoryEntries(existing: HistoryEntry[], incoming: HistoryEntry[]): HistoryEntry[] {
  const merged: HistoryEntry[] = [];
  const seen = new Set<string>();

  for (const entry of incoming) {
    if (!seen.has(entry.id)) {
      seen.add(entry.id);
      merged.push(entry);
    }
  }

  for (const entry of existing) {
    if (!seen.has(entry.id)) {
      seen.add(entry.id);
      merged.push(entry);
    }
  }

  return merged;
}
export function getHistoryEntries(repoRoot: string): HistoryEntry[] {
  return readHistoryEntries(repoRoot);
}

export function appendHistoryEntries(repoRoot: string, entries: HistoryEntry[]): HistoryEntry[] {
  if (!entries.length) {
    return readHistoryEntries(repoRoot);
  }
  const existing = readHistoryEntries(repoRoot);
  const merged = mergeHistoryEntries(existing, entries.filter((entry) => entry.protocol === 'v2'));
  writeHistoryEntries(repoRoot, merged);
  return merged;
}
