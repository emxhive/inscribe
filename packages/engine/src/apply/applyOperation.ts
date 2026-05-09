import * as fs from 'fs';
import * as path from 'path';
import {
  Operation,
  RESTORE_DIRECTIVE_V2_PAYLOAD,
  RESTORE_DIRECTIVE_V2_SCHEMA,
  RestorePayloadV2,
} from '@inscribe/shared';

import { resolveAndAssertWithinRepo } from '../paths/resolveAndAssertWithin';
import { getEffectiveIgnoreMatchers } from '../repository';
import { restoreFromPayload } from './restoreV2';
import { validateCandidateOrThrow } from './candidateValidation';
import { resolveOperationContent } from '../operation/resolveOperationContent';

export interface OperationExecution {
  beforeContent: string;
  afterContent: string;
}

export function applyOperation(operation: Operation, repoRoot: string): OperationExecution {
  const ignoreMatcher = getEffectiveIgnoreMatchers(repoRoot);
  const { resolvedPath } = resolveAndAssertWithinRepo(repoRoot, operation.file, ignoreMatcher);
  const filePath = resolvedPath;
  const directives = operation.directives ?? {};
  const beforeContent = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : '';

  switch (operation.type) {
    case 'create': {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      const resolved = resolveOperationContent(operation, beforeContent);
      validateCandidateOrThrow(operation.file, operation.type, resolved.afterContent);
      fs.writeFileSync(filePath, resolved.afterContent);
      return { beforeContent, afterContent: resolved.afterContent };
    }

    case 'replace': {
      const restored = tryApplyRestoreV2(beforeContent, directives);
      if (restored !== undefined) {
        validateCandidateOrThrow(operation.file, operation.type, restored);
        fs.writeFileSync(filePath, restored);
        return { beforeContent, afterContent: restored };
      }
      const resolved = resolveOperationContent(operation, beforeContent);
      validateCandidateOrThrow(operation.file, operation.type, resolved.afterContent);
      fs.writeFileSync(filePath, resolved.afterContent);
      return { beforeContent, afterContent: resolved.afterContent };
    }

    case 'append': {
      const restored = tryApplyRestoreV2(beforeContent, directives);
      if (restored !== undefined) {
        validateCandidateOrThrow(operation.file, operation.type, restored);
        fs.writeFileSync(filePath, restored);
        return { beforeContent, afterContent: restored };
      }
      const resolved = resolveOperationContent(operation, beforeContent);
      validateCandidateOrThrow(operation.file, operation.type, resolved.afterContent);
      fs.writeFileSync(filePath, resolved.afterContent);
      return { beforeContent, afterContent: resolved.afterContent };
    }

    case 'range': {
      const restored = tryApplyRestoreV2(beforeContent, directives);
      if (restored !== undefined) {
        validateCandidateOrThrow(operation.file, operation.type, restored);
        fs.writeFileSync(filePath, restored);
        return { beforeContent, afterContent: restored };
      }
      const resolved = resolveOperationContent(operation, beforeContent);
      validateCandidateOrThrow(operation.file, operation.type, resolved.afterContent, {
        START: operation.directives?.START ?? '',
        END_NODE: operation.directives?.END_NODE ?? '',
        CONTAINS: operation.directives?.CONTAINS ?? '',
      });
      fs.writeFileSync(filePath, resolved.afterContent);
      return { beforeContent, afterContent: resolved.afterContent };
    }
    case 'replace_symbol': {
      const restored = tryApplyRestoreV2(beforeContent, directives);
      if (restored !== undefined) {
        validateCandidateOrThrow(operation.file, operation.type, restored);
        fs.writeFileSync(filePath, restored);
        return { beforeContent, afterContent: restored };
      }
      const resolved = resolveOperationContent(operation, beforeContent);
      validateCandidateOrThrow(operation.file, operation.type, resolved.afterContent, { NAME: directives.NAME ?? '' });
      fs.writeFileSync(filePath, resolved.afterContent);
      return { beforeContent, afterContent: resolved.afterContent };
    }

    case 'delete': {
      const restored = tryApplyRestoreV2(beforeContent, directives);
      if (restored !== undefined) {
        if (restored.length === 0) {
          fs.unlinkSync(filePath);
          cleanupEmptyDirs(filePath, repoRoot);
          return { beforeContent, afterContent: '' };
        }
        fs.writeFileSync(filePath, restored);
        return { beforeContent, afterContent: restored };
      }
      fs.unlinkSync(filePath);
      cleanupEmptyDirs(filePath, repoRoot);
      return { beforeContent, afterContent: '' };
    }

    default:
      throw new Error(`Unknown operation type: ${operation.type}`);
  }
}

function cleanupEmptyDirs(filePath: string, repoRoot: string): void {
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

function tryApplyRestoreV2(current: string, directives: Record<string, string>): string | undefined {
  if (directives[RESTORE_DIRECTIVE_V2_SCHEMA] !== '2') {
    return undefined;
  }

  const encoded = directives[RESTORE_DIRECTIVE_V2_PAYLOAD];
  if (!encoded) {
    throw new Error('Unsafe to restore: missing restore payload.');
  }

  let payload: RestorePayloadV2;
  try {
    payload = JSON.parse(encoded) as RestorePayloadV2;
  } catch {
    throw new Error('Unsafe to restore: invalid restore payload.');
  }

  const resolution = restoreFromPayload(current, payload);
  if (!resolution.canResolve || resolution.resolvedContent === undefined) {
    throw new Error(resolution.error ?? 'Unsafe to restore: could not locate applied section.');
  }

  return resolution.resolvedContent;
}
