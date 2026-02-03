import * as fs from 'fs';
import * as path from 'path';
import {
  Operation,
  RESTORE_DIRECTIVE_EXPECT_APPEND_AT_END,
  RESTORE_DIRECTIVE_EXPECT_CONTENT,
  RESTORE_DIRECTIVE_REMOVE_APPEND,
} from '@inscribe/shared';

import { applyRangeReplace } from './rangeReplace';
import { resolveAndAssertWithinRepo } from '../paths/resolveAndAssertWithin';
import { getEffectiveIgnoreMatchers } from '../repository';

export function applyOperation(operation: Operation, repoRoot: string): void {
  const ignoreMatcher = getEffectiveIgnoreMatchers(repoRoot);
  const { resolvedPath } = resolveAndAssertWithinRepo(repoRoot, operation.file, ignoreMatcher);
  const filePath = resolvedPath;
  const directives = operation.directives ?? {};

  switch (operation.type) {
    case 'create':
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, operation.content);
      break;

    case 'replace':
      assertExpectedContent(filePath, directives[RESTORE_DIRECTIVE_EXPECT_CONTENT]);
      fs.writeFileSync(filePath, operation.content);
      break;

    case 'append':
      if (directives[RESTORE_DIRECTIVE_REMOVE_APPEND] === 'true') {
        const expectedAppend =
          directives[RESTORE_DIRECTIVE_EXPECT_APPEND_AT_END] ?? operation.content;
        const content = fs.readFileSync(filePath, 'utf-8');
        if (!content.endsWith(expectedAppend)) {
          throw new Error('Unsafe to restore: appended content not found at file end.');
        }
        const updated = content.slice(0, content.length - expectedAppend.length);
        fs.writeFileSync(filePath, updated);
      } else {
        fs.appendFileSync(filePath, operation.content);
      }
      break;

    case 'range':
      applyRangeReplace(filePath, operation);
      break;

    case 'delete':
      assertExpectedContent(filePath, directives[RESTORE_DIRECTIVE_EXPECT_CONTENT]);
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

function assertExpectedContent(filePath: string, expected?: string) {
  if (expected === undefined) {
    return;
  }
  if (!fs.existsSync(filePath)) {
    throw new Error('Unsafe to restore: file is missing.');
  }
  const current = fs.readFileSync(filePath, 'utf-8');
  if (current !== expected) {
    throw new Error('Unsafe to restore: file content has changed since apply.');
  }
}
