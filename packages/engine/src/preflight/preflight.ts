import * as fs from 'fs';
import * as path from 'path';
import { Operation, OperationMode } from '@inscribe/shared';
import { getEffectiveIgnoreMatchers } from '../repo/ignoreRules';
import { validateCandidateOrThrow } from './candidateValidation';
import { resolveOperationExecution, OperationExecutionResult } from '../operation/resolveOperationExecution';
import { enforcePathPolicy } from '../paths/pathPolicy';
import { getScopeState } from '../repo/scopeStore';

export type PreflightExecution = OperationExecutionResult & {
  operationIndex: number;
  resolvedPath: string;
  canonicalPath?: string;
};

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

/**
 * Simulates a sequence of operations against the repository state.
 * Manages virtual file state and handles disk reading of initial state.
 */
export function preflightOperations(operations: Operation[], repoRoot: string): PreflightExecution[] {
  const ignoreMatcher = getEffectiveIgnoreMatchers(repoRoot);
  const scopeState = getScopeState(repoRoot);
  const scopeRoots = scopeState?.scope ?? [];
  const virtualFiles = new Map<string, VirtualFileState>();
  const executions: PreflightExecution[] = [];

  for (const [operationIndex, operation] of operations.entries()) {
    try {
      const { resolvedPath, canonicalPath } = enforcePathPolicy(
        repoRoot,
        operation.file,
        operation.type as OperationMode,
        scopeRoots,
        ignoreMatcher
      );
      const before = getVirtualFileState(virtualFiles, canonicalPath, resolvedPath);
      const next = resolveOperationExecution(operation, before);

      if (next.afterExists) {
        validateCandidateOrThrow(operation.file, operation.type, next.afterContent, validationMetadata(operation));
      }

      virtualFiles.set(canonicalPath, { exists: next.afterExists, content: next.afterContent });
      executions.push({ ...next, operationIndex, resolvedPath, canonicalPath });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown preflight error';
      throw new PreflightError(message, operation, operationIndex);
    }
  }

  return executions;
}

function getVirtualFileState(files: Map<string, VirtualFileState>, canonicalPath: string, filePath: string): VirtualFileState {
  const existing = files.get(canonicalPath);
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
