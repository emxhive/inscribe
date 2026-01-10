import * as crypto from 'crypto';
import * as path from 'path';
import type { IndexStatus } from '@shared';

const indexStatusMap = new Map<string, IndexStatus & { count?: number }>();

export function repoKey(repoRoot: string): string {
  return crypto.createHash('sha256').update(path.resolve(repoRoot)).digest('hex');
}

export function setIndexStatusRunning(repoRoot: string): void {
  indexStatusMap.set(repoKey(repoRoot), { state: 'running' });
}

export function setIndexStatusComplete(repoRoot: string, count: number): void {
  indexStatusMap.set(repoKey(repoRoot), { state: 'complete', count });
}

export function setIndexStatusError(repoRoot: string, error: unknown): void {
  indexStatusMap.set(repoKey(repoRoot), {
    state: 'error',
    message: error instanceof Error ? error.message : 'Unknown error',
  });
}

export function getIndexStatus(repoRoot: string): IndexStatus {
  return indexStatusMap.get(repoKey(repoRoot)) ?? { state: 'idle' };
}
