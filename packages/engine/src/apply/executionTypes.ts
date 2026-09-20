import * as fs from 'fs';
import * as path from 'path';
import type { Operation } from '@inscribe/shared';

export interface PreflightExecution {
  kind: 'file_content' | 'file_delete' | 'partial_replacement';
  mode: Operation['type'];
  operation: Operation;
  beforeExists: boolean;
  afterExists: boolean;
  beforeContent: string;
  afterContent: string;
  operationIndex: number;
  resolvedPath: string;
  canonicalPath?: string;
}

export function cleanupEmptyDirs(filePath: string, repoRoot: string): void {
  let currentDir = path.dirname(filePath);
  const normalizedRepoRoot = path.resolve(repoRoot);

  while (path.resolve(currentDir) !== normalizedRepoRoot) {
    try {
      const entries = fs.readdirSync(currentDir);
      if (entries.length === 0) {
        fs.rmdirSync(currentDir);
        currentDir = path.dirname(currentDir);
      } else {
        break;
      }
    } catch {
      break;
    }
  }
}
