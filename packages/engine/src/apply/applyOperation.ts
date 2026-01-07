import * as fs from 'fs';
import * as path from 'path';
import { Operation } from '@inscribe/shared';
import { resolveAndAssertWithin } from '../paths/resolveAndAssertWithin';
import { applyRangeReplace } from './rangeReplace';

export function applyOperation(operation: Operation, repoRoot: string, scopeRoots?: string[]): void {
  const { resolvedPath } = resolveAndAssertWithin(repoRoot, operation.file, scopeRoots);
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

    default:
      throw new Error(`Unsupported operation type: ${operation.type}`);
  }
}
