import * as fs from 'fs';
import * as path from 'path';
import { Operation } from '@inscribe/shared';

import { applyRangeReplace } from './rangeReplace';
import { resolveAndAssertWithinRepo } from '../paths/resolveAndAssertWithin';
import { getEffectiveIgnoreMatchers } from '../repository';

export function applyOperation(operation: Operation, repoRoot: string): void {
  const ignoreMatcher = getEffectiveIgnoreMatchers(repoRoot);
  const { resolvedPath } = resolveAndAssertWithinRepo(repoRoot, operation.file, ignoreMatcher);
  const filePath = resolvedPath;

  switch (operation.type) {
    case 'create':
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, operation.content);
      break;

    case 'replace':
      fs.writeFileSync(filePath, operation.content);
      break;

    case 'append':
      fs.appendFileSync(filePath, operation.content);
      break;

    case 'range':
      applyRangeReplace(filePath, operation);
      break;

    case 'delete':
      // Delete the file
      fs.unlinkSync(filePath);
      
      // Clean up empty parent directories (up to repoRoot)
      // Walk up the directory tree and remove empty directories
      let currentDir = path.dirname(filePath);
      const normalizedRepoRoot = path.resolve(repoRoot);
      
      while (path.resolve(currentDir) !== normalizedRepoRoot) {
        try {
          const entries = fs.readdirSync(currentDir);
          if (entries.length === 0) {
            fs.rmdirSync(currentDir);
            currentDir = path.dirname(currentDir);
          } else {
            // Stop if directory is not empty
            break;
          }
        } catch {
          // Stop if we can't read or remove directory
          break;
        }
      }
      break;

    default:
      throw new Error(`Unknown operation type: ${operation.type}`);
  }
}
