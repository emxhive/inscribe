import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Operation } from '@inscribe/shared';
import { applyChanges } from '../src/apply/applyChanges';
import { preflightOperations } from '../src/preflight/preflight';

let workspaceRoot = '';
let repoRoot = '';
let outsideRoot = '';

beforeEach(() => {
  workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'inscribe-path-safety-'));
  repoRoot = path.join(workspaceRoot, 'repo');
  outsideRoot = path.join(workspaceRoot, 'outside');
  fs.mkdirSync(repoRoot, { recursive: true });
  fs.mkdirSync(outsideRoot, { recursive: true });
  process.env.INSCRIBE_USER_DATA = path.join(workspaceRoot, 'user-data');
});

afterEach(() => {
  delete process.env.INSCRIBE_USER_DATA;
  fs.rmSync(workspaceRoot, { recursive: true, force: true });
});

describe('path safety', () => {
  it('rejects traversal outside the repository', () => {
    const result = applyChanges({
      operations: [createFile('../outside.txt', 'outside\n')],
    }, repoRoot);

    expect(result.success).toBe(false);
    expect(result.errors?.join('\n')).toContain('outside repository root');
    expect(fs.existsSync(path.join(workspaceRoot, 'outside.txt'))).toBe(false);
  });

  it('rejects absolute paths', () => {
    const absoluteTarget = path.join(repoRoot, 'absolute.txt');
    const result = applyChanges({
      operations: [createFile(absoluteTarget, 'absolute\n')],
    }, repoRoot);

    expect(result.success).toBe(false);
    expect(result.errors?.join('\n')).toContain('Absolute file paths are not allowed');
    expect(fs.existsSync(absoluteTarget)).toBe(false);
  });

  it('allows writes to ignored paths because ignore only controls indexing', () => {
    const result = applyChanges({
      operations: [createFile('node_modules/pkg/file.txt', 'ignored\n')],
    }, repoRoot);

    expect(result.success).toBe(true);
    expect(fs.readFileSync(path.join(repoRoot, 'node_modules/pkg/file.txt'), 'utf-8')).toBe('ignored\n');
  });

  it('rejects create_file through a symlinked directory that escapes the repository', () => {
    const linkPath = path.join(repoRoot, 'linked');
    if (!createDirectoryLink(outsideRoot, linkPath)) return;

    const result = applyChanges({
      operations: [createFile('linked/created.txt', 'created\n')],
    }, repoRoot);

    expect(result.success).toBe(false);
    expect(result.errors?.join('\n')).toContain('symlink traversal');
    expect(fs.existsSync(path.join(outsideRoot, 'created.txt'))).toBe(false);
  });

  it('rejects replace_file through a symlinked directory that escapes the repository', () => {
    fs.mkdirSync(path.join(repoRoot, 'src'), { recursive: true });
    fs.writeFileSync(path.join(outsideRoot, 'existing.txt'), 'old\n');
    const linkPath = path.join(repoRoot, 'src', 'linked');
    if (!createDirectoryLink(outsideRoot, linkPath)) return;

    const result = applyChanges({
      operations: [{
        type: 'replace_file',
        file: 'src/linked/existing.txt',
        content: 'new\n',
        blockIndex: 0,
      }],
    }, repoRoot);

    expect(result.success).toBe(false);
    expect(result.errors?.join('\n')).toContain('symlink traversal');
    expect(fs.readFileSync(path.join(outsideRoot, 'existing.txt'), 'utf-8')).toBe('old\n');
  });

  it('uses one virtual file identity for casing aliases on Windows', () => {
    fs.mkdirSync(path.join(repoRoot, 'src'), { recursive: true });
    const operations: Operation[] = [
      createFile('src/CaseAlias.txt', 'first\n'),
      {
        type: 'replace_file',
        file: 'src/casealias.txt',
        content: 'second\n',
        blockIndex: 1,
      },
    ];

    if (process.platform !== 'win32') {
      expect(() => preflightOperations(operations, repoRoot)).toThrow('File does not exist');
      return;
    }

    const executions = preflightOperations(operations, repoRoot);
    expect(executions).toHaveLength(2);
    expect(executions[1].beforeContent).toBe('first\n');
    expect(executions[1].afterContent).toBe('second\n');
    expect(executions[0].canonicalPath).toBe(executions[1].canonicalPath);
  });
});

function createFile(file: string, content: string): Operation {
  return {
    type: 'create_file',
    file,
    content,
    blockIndex: 0,
  };
}

function createDirectoryLink(target: string, linkPath: string): boolean {
  try {
    fs.symlinkSync(target, linkPath, process.platform === 'win32' ? 'junction' : 'dir');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Skipping symlink assertion because the platform refused link creation: ${message}`);
    return false;
  }

  if (!fs.existsSync(linkPath)) {
    throw new Error('Failed to create symlink for path safety test');
  }

  return true;
}
