import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { indexRepository } from '../src/repo/indexer';

let workspaceRoot = '';
let repoRoot = '';

beforeEach(() => {
  workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'inscribe-indexer-'));
  repoRoot = path.join(workspaceRoot, 'repo');
  fs.mkdirSync(repoRoot, { recursive: true });
  process.env.INSCRIBE_USER_DATA = path.join(workspaceRoot, 'user-data');
});

afterEach(() => {
  delete process.env.INSCRIBE_USER_DATA;
  fs.rmSync(workspaceRoot, { recursive: true, force: true });
});

describe('indexRepository', () => {
  it('indexes the repository recursively while excluding ignored paths', () => {
    writeRepoFile('src/app.ts', 'app\n');
    writeRepoFile('docs/readme.md', 'docs\n');
    writeRepoFile('node_modules/pkg/index.js', 'ignored default\n');
    writeRepoFile('dist/app.js', 'ignored build\n');
    writeRepoFile('.env', 'ignored dotfile\n');
    writeRepoFile('.github/workflows/ci.yml', 'ignored dotfolder\n');
    writeRepoFile('src/.cache/data.json', 'ignored nested dotfolder\n');
    writeRepoFile('generated/out.txt', 'ignored custom\n');
    fs.writeFileSync(path.join(repoRoot, '.inscribeignore'), 'generated/\n');

    expect(indexRepository(repoRoot)).toEqual([
      'docs/readme.md',
      'src/app.ts',
    ]);
  });

  it('allows user unignore rules to override default ignores', () => {
    writeRepoFile('src/app.ts', 'app\n');
    writeRepoFile('.github/workflows/ci.yml', 'ci\n');
    writeRepoFile('dist/app.js', 'build output\n');
    fs.writeFileSync(path.join(repoRoot, '.inscribeignore'), '!.github/\n!dist/\n');

    expect(indexRepository(repoRoot)).toEqual([
      '.github/workflows/ci.yml',
      'dist/app.js',
      'src/app.ts',
    ]);
  });
});

function writeRepoFile(relativePath: string, content: string) {
  const target = path.join(repoRoot, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}
