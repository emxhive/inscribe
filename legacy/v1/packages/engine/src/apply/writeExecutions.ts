import * as fs from 'fs';
import * as path from 'path';
import { cleanupEmptyDirs, type PreflightExecution } from '../preflight/preflight';

export function writeExecutions(executions: PreflightExecution[], repoRoot: string): void {
  const written: PreflightExecution[] = [];

  try {
    for (const execution of executions) {
      writeExecution(execution, repoRoot);
      written.push(execution);
    }
  } catch (error) {
    const rollbackErrors = rollbackExecutions(written, repoRoot);
    if (rollbackErrors.length > 0) {
      const message = error instanceof Error ? error.message : 'Unknown write error';
      throw new Error(`${message}\nRollback errors:\n${rollbackErrors.join('\n')}`);
    }

    throw error;
  }
}

export function writeExecution(execution: PreflightExecution, repoRoot: string): void {
  if (execution.afterExists) {
    fs.mkdirSync(path.dirname(execution.resolvedPath), { recursive: true });
    fs.writeFileSync(execution.resolvedPath, execution.afterContent);
    return;
  }

  if (fs.existsSync(execution.resolvedPath)) {
    fs.unlinkSync(execution.resolvedPath);
    cleanupEmptyDirs(execution.resolvedPath, repoRoot);
  }
}

export function rollbackExecutions(executions: PreflightExecution[], repoRoot: string): string[] {
  const errors: string[] = [];

  for (const execution of [...executions].reverse()) {
    try {
      if (execution.beforeExists) {
        fs.mkdirSync(path.dirname(execution.resolvedPath), { recursive: true });
        fs.writeFileSync(execution.resolvedPath, execution.beforeContent);
      } else if (fs.existsSync(execution.resolvedPath)) {
        fs.unlinkSync(execution.resolvedPath);
        cleanupEmptyDirs(execution.resolvedPath, repoRoot);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown rollback error';
      errors.push(`${execution.operation.file}: ${message}`);
    }
  }

  return errors;
}
