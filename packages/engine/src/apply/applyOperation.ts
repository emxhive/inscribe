import * as fs from 'fs';
import * as path from 'path';
import { Operation } from '@inscribe/shared';
import { applyRangeReplace } from './rangeReplace';

export function applyOperation(operation: Operation, repoRoot: string): void {
  const filePath = path.join(repoRoot, operation.file);

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
  }
}
