import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import {
  APPLIED_INPUT_STORE_DIR,
  INSCRIBE_DIR,
  type AppliedAiInputRecord,
} from '@inscribe/shared';
import { getUserDataPath } from './storePath';
import { repoKey } from './statusStore';

type AppliedInputStore = Record<string, AppliedAiInputRecord>;

type RecordAppliedInputOptions = {
  appliedAt?: string;
  appliedBlockCount: number;
  applyId?: string;
};

function getAppliedInputStorePath(repoRoot: string): string {
  const baseDir = path.join(getUserDataPath(), INSCRIBE_DIR, APPLIED_INPUT_STORE_DIR);
  fs.mkdirSync(baseDir, { recursive: true });
  return path.join(baseDir, `${repoKey(repoRoot)}.json`);
}

export function normalizeAppliedAiInput(rawInput: string): string {
  return rawInput.replace(/\r\n?/g, '\n').trim();
}

export function hashAppliedAiInput(rawInput: string): string {
  return crypto
    .createHash('sha256')
    .update(normalizeAppliedAiInput(rawInput), 'utf-8')
    .digest('hex');
}

function readAppliedInputStore(repoRoot: string): AppliedInputStore {
  const storePath = getAppliedInputStorePath(repoRoot);
  if (!fs.existsSync(storePath)) {
    return {};
  }

  try {
    const raw = fs.readFileSync(storePath, 'utf-8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeAppliedInputStore(repoRoot: string, store: AppliedInputStore): void {
  const storePath = getAppliedInputStorePath(repoRoot);
  const tempPath = `${storePath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(store, null, 2));
  fs.renameSync(tempPath, storePath);
}

export function getAppliedAiInputRecord(
  repoRoot: string,
  rawInput: string,
): AppliedAiInputRecord | null {
  const normalized = normalizeAppliedAiInput(rawInput);
  if (!normalized) {
    return null;
  }

  const inputHash = hashAppliedAiInput(normalized);
  return readAppliedInputStore(repoRoot)[inputHash] ?? null;
}

export function recordAppliedAiInput(
  repoRoot: string,
  rawInput: string,
  options: RecordAppliedInputOptions,
): AppliedAiInputRecord | null {
  const normalized = normalizeAppliedAiInput(rawInput);
  if (!normalized || options.appliedBlockCount <= 0) {
    return null;
  }

  const inputHash = hashAppliedAiInput(normalized);
  const appliedAt = options.appliedAt ?? new Date().toISOString();
  const store = readAppliedInputStore(repoRoot);
  const existing = store[inputHash];
  const record: AppliedAiInputRecord = existing
    ? {
        ...existing,
        lastAppliedAt: appliedAt,
        timesApplied: existing.timesApplied + 1,
        appliedBlockCount: options.appliedBlockCount,
        lastApplyId: options.applyId,
      }
    : {
        inputHash,
        firstAppliedAt: appliedAt,
        lastAppliedAt: appliedAt,
        timesApplied: 1,
        appliedBlockCount: options.appliedBlockCount,
        lastApplyId: options.applyId,
      };

  store[inputHash] = record;
  writeAppliedInputStore(repoRoot, store);
  return record;
}
