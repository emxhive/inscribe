import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Operation } from '@inscribe/shared';
import type { PreflightExecution } from '../src/preflight/preflight';
import { writeExecutions } from '../src/apply/writeExecutions';

let workspaceRoot = '';
let repoRoot = '';

beforeEach(() => {
  workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'inscribe-writer-test-'));
  repoRoot = path.join(workspaceRoot, 'repo');
  fs.mkdirSync(repoRoot, { recursive: true });
});

afterEach(() => {
  fs.rmSync(workspaceRoot, { recursive: true, force: true });
});

describe('writeExecutions', () => {
  it('writes content when afterExists is true', () => {
    writeExecutions([
      fileContentExecution({
        file: 'nested/file.txt',
        resolvedPath: filePath('nested/file.txt'),
        beforeExists: false,
        beforeContent: '',
        afterExists: true,
        afterContent: 'written\n',
      }),
    ], repoRoot);

    expect(readRepoFile('nested/file.txt')).toBe('written\n');
  });

  it('deletes files when afterExists is false', () => {
    fs.mkdirSync(filePath('nested'), { recursive: true });
    fs.writeFileSync(filePath('nested/file.txt'), 'content\n');

    writeExecutions([
      fileDeleteExecution({
        file: 'nested/file.txt',
        resolvedPath: filePath('nested/file.txt'),
        beforeExists: true,
        beforeContent: 'content\n',
        afterExists: false,
        afterContent: '',
      }),
    ], repoRoot);

    expect(fs.existsSync(filePath('nested/file.txt'))).toBe(false);
    expect(fs.existsSync(filePath('nested'))).toBe(false);
  });

  it('rolls back earlier writes if a later write fails', () => {
    fs.writeFileSync(filePath('first.txt'), 'original\n');

    expect(() => writeExecutions([
      fileContentExecution({
        file: 'first.txt',
        resolvedPath: filePath('first.txt'),
        beforeExists: true,
        beforeContent: 'original\n',
        afterExists: true,
        afterContent: 'changed\n',
      }),
      fileContentExecution({
        file: '.',
        resolvedPath: repoRoot,
        beforeExists: true,
        beforeContent: '',
        afterExists: true,
        afterContent: 'cannot write to directory',
      }),
    ], repoRoot)).toThrow();

    expect(readRepoFile('first.txt')).toBe('original\n');
  });
});

function fileContentExecution(input: {
  file: string;
  resolvedPath: string;
  beforeExists: boolean;
  beforeContent: string;
  afterExists: true;
  afterContent: string;
}): PreflightExecution {
  const operation = operationFor(input.file, input.afterContent);
  return {
    kind: 'file_content',
    mode: 'replace_file',
    operation,
    beforeExists: input.beforeExists,
    beforeContent: input.beforeContent,
    afterExists: input.afterExists,
    afterContent: input.afterContent,
    operationIndex: 0,
    resolvedPath: input.resolvedPath,
  };
}

function fileDeleteExecution(input: {
  file: string;
  resolvedPath: string;
  beforeExists: boolean;
  beforeContent: string;
  afterExists: false;
  afterContent: string;
}): PreflightExecution {
  const operation = operationFor(input.file, '');
  return {
    kind: 'file_delete',
    mode: 'delete_file',
    operation,
    beforeExists: input.beforeExists,
    beforeContent: input.beforeContent,
    afterExists: input.afterExists,
    afterContent: input.afterContent,
    operationIndex: 0,
    resolvedPath: input.resolvedPath,
  };
}

function operationFor(file: string, content: string): Operation {
  return {
    type: 'replace_file',
    file,
    content,
    blockIndex: 0,
  };
}

function filePath(relativePath: string): string {
  return path.join(repoRoot, relativePath);
}

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(filePath(relativePath), 'utf-8');
}
