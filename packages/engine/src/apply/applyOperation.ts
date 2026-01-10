import * as fs from 'fs';
import * as path from 'path';
import { Operation } from '@inscribe/shared';
import {resolveAndAssertWithin, resolveAndAssertWithinRepo} from '../paths/resolveAndAssertWithin';
import { applyRangeReplace } from './rangeReplace';

export function applyOperation(operation: Operation, repoRoot: string): void {
  const { resolvedPath } = resolveAndAssertWithinRepo(repoRoot, operation.file, []);
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
      throw new Error(`Unknown operation type: ${operation.type}`);
  }
}
