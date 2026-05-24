import * as fs from 'fs';
import * as path from 'path';
import { Operation, RESTORE_DIRECTIVE_V2_PAYLOAD, RESTORE_DIRECTIVE_V2_SCHEMA, RestorePayloadV2 } from '@inscribe/shared';
import { resolveAndAssertWithinRepo } from '../paths/resolveAndAssertWithin';
import { getEffectiveIgnoreMatchers } from '../repository';
import { restoreFromPayload } from './restoreV2';
import { validateCandidateOrThrow } from './candidateValidation';
import { resolveOperationContent } from '../operation/resolveOperationContent';

export interface PreflightExecution {
  operation: Operation;
  operationIndex: number;
  resolvedPath: string;
  beforeExists: boolean;
  afterExists: boolean;
  beforeContent: string;
  afterContent: string;
}

interface VirtualFileState {
  exists: boolean;
  content: string;
}

export class PreflightError extends Error {
  constructor(
    message: string,
    readonly operation: Operation,
    readonly operationIndex: number
  ) {
    super(message);
    this.name = 'PreflightError';
  }
}

export function preflightOperations(operations: Operation[], repoRoot: string): PreflightExecution[] {
  const ignoreMatcher = getEffectiveIgnoreMatchers(repoRoot);
  const virtualFiles = new Map<string, VirtualFileState>();
  const executions: PreflightExecution[] = [];

  for (const [operationIndex, operation] of operations.entries()) {
    try {
      const { resolvedPath } = resolveAndAssertWithinRepo(repoRoot, operation.file, ignoreMatcher);
      const before = getVirtualFileState(virtualFiles, resolvedPath);
      assertModeCanApply(operation, before.exists);

      const next = resolveNextState(operation, before);

      if (next.exists) {
        validateCandidateOrThrow(operation.file, operation.type, next.content, validationMetadata(operation));
      }

      virtualFiles.set(resolvedPath, next);
      executions.push({
        operation,
        operationIndex,
        resolvedPath,
        beforeExists: before.exists,
        afterExists: next.exists,
        beforeContent: before.content,
        afterContent: next.content,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown preflight error';
      throw new PreflightError(message, operation, operationIndex);
    }
  }

  return executions;
}

function getVirtualFileState(files: Map<string, VirtualFileState>, filePath: string): VirtualFileState {
  const existing = files.get(filePath);
  if (existing) {
    return { ...existing };
  }

  if (!fs.existsSync(filePath)) {
    return { exists: false, content: '' };
  }

  return {
    exists: true,
    content: fs.readFileSync(filePath, 'utf-8'),
  };
}

function assertModeCanApply(operation: Operation, fileExists: boolean): void {
  switch (operation.type) {
    case 'create_file':
      if (fileExists) {
        throw new Error('File already exists (MODE: create requires non-existing file)');
      }
      return;
    case 'replace_file':
    case 'append_file':
    case 'replace_file':
    case 'append_file':
    case 'replace_line':
    case 'replace_range':
    case 'replace_between':
    case 'replace_block':
    case 'replace_symbol':
    case 'delete_file':
      if (!fileExists) {
        throw new Error(`File does not exist (MODE: ${operation.type} requires existing file)`);
      }
      return;
    default:
      throw new Error(`Unknown operation type: ${operation.type}`);
  }
}

function resolveNextState(operation: Operation, before: VirtualFileState): VirtualFileState {
  switch (operation.type) {
    case 'create_file':
      return { exists: true, content: operation.content };
    case 'replace_file':
    case 'append_file':
    case 'replace_file':
    case 'append_file':
    case 'replace_line':
    case 'replace_range':
    case 'replace_between':
    case 'replace_block':
    case 'replace_symbol': {
      const restored = tryApplyRestoreV2(before.content, operation.directives ?? {});
      if (restored !== undefined) {
        return { exists: true, content: restored };
      }

      const resolved = resolveOperationContent(operation, before.content);
      return { exists: true, content: resolved.afterContent };
    }
    case 'delete_file':
      const restored = tryApplyRestoreV2(before.content, operation.directives ?? {});
      if (restored !== undefined && restored.length > 0) {
        return { exists: true, content: restored };
      }

      return { exists: false, content: '' };
    default:
      throw new Error(`Unknown operation type: ${operation.type}`);
  }
}

export function tryApplyRestoreV2(current: string, directives: Record<string, string>): string | undefined {
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

function validationMetadata(operation: Operation): Record<string, string> {
  if (operation.type === 'replace_range' || operation.type === 'replace_between' || operation.type === 'replace_line' || operation.type === 'replace_block') {
    return {
      START: operation.directives?.START ?? '',
      CONTAINS: operation.directives?.CONTAINS ?? '',
    };
  }

  if (operation.type === 'replace_symbol') {
    return {
      NAME: operation.directives?.NAME ?? '',
    };
  }

  return {};
}
