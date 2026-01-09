import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  readIgnoreRules,
  getEffectiveIgnorePrefixes,
  computeSuggestedExcludes,
  computeDefaultScope,
  indexRepository,
  setScopeState,
  validateBlocks,
} from '../src';

describe('Repository helpers', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'inscribe-repo-'));
    process.env.INSCRIBE_USER_DATA = path.join(tempDir, 'user-data');
  });

  afterEach(() => {
    delete process.env.INSCRIBE_USER_DATA;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('parses .inscribeignore with comments and blank lines', () => {
    const ignorePath = path.join(tempDir, '.inscribeignore');
    fs.writeFileSync(
      ignorePath,
      `
# comment
 build

dist 
  tmp
# another
tmp
`
    );

    const rules = readIgnoreRules(tempDir);
    expect(rules.entries).toEqual(['build/', 'dist/', 'tmp/']);
  });

  it('merges effective ignores with defaults and dedupes', () => {
    const ignorePath = path.join(tempDir, '.inscribeignore');
    fs.writeFileSync(ignorePath, 'custom\nnode_modules\ncustom/');

    const effective = getEffectiveIgnorePrefixes(tempDir);
    expect(effective.filter(p => p === 'node_modules/').length).toBe(1);
    expect(effective).toContain('custom/');
    expect(effective).toContain('.git/');
  });

  it('computes deterministic suggested excludes', () => {
    fs.mkdirSync(path.join(tempDir, 'dist'), { recursive: true });
    fs.mkdirSync(path.join(tempDir, 'heavy'), { recursive: true });
    fs.mkdirSync(path.join(tempDir, 'src'), { recursive: true });

    for (let i = 0; i < 205; i++) {
      fs.writeFileSync(path.join(tempDir, 'heavy', `file-${i}.txt`), 'x');
    }

    const suggested = computeSuggestedExcludes(tempDir);
    expect(suggested).toEqual(['dist/', 'heavy/']);
  });

  it('computes default scope as top-level minus suggested', () => {
    fs.mkdirSync(path.join(tempDir, 'dist'), { recursive: true });
    fs.mkdirSync(path.join(tempDir, 'heavy'), { recursive: true });
    fs.mkdirSync(path.join(tempDir, 'src'), { recursive: true });
    fs.mkdirSync(path.join(tempDir, 'docs'), { recursive: true });

    for (let i = 0; i < 205; i++) {
      fs.writeFileSync(path.join(tempDir, 'heavy', `file-${i}.txt`), 'x');
    }

    const defaults = computeDefaultScope(tempDir);
    expect(defaults.topLevel).toEqual(['dist/', 'docs/', 'heavy/', 'src/']);
    expect(defaults.suggested).toEqual(['dist/', 'heavy/']);
    expect(defaults.scope).toEqual(['docs/', 'src/']);
  });

  it('indexes only scoped and non-ignored files', () => {
    fs.mkdirSync(path.join(tempDir, 'src', 'kept'), { recursive: true });
    fs.mkdirSync(path.join(tempDir, 'src', 'ignored'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, '.inscribeignore'), 'src/ignored');
    fs.writeFileSync(path.join(tempDir, 'src', 'kept', 'file.txt'), 'ok');
    fs.writeFileSync(path.join(tempDir, 'src', 'ignored', 'skip.txt'), 'skip');

    setScopeState(tempDir, ['src/']);
    const files = indexRepository(tempDir);
    expect(files).toEqual(['src/kept/file.txt']);
  });

  it('validation allows create outside scope, rejects ignored prefixes', () => {
    setScopeState(tempDir, ['src/']);
    fs.writeFileSync(path.join(tempDir, '.inscribeignore'), 'src/ignore');

    const blocks = [
      {
        file: 'docs/file.ts',
        mode: 'create',
        directives: {},
        content: '',
        blockIndex: 0,
      },
      {
        file: 'src/ignore/file.ts',
        mode: 'create',
        directives: {},
        content: '',
        blockIndex: 1,
      },
    ];

    const errors = validateBlocks(blocks as any, tempDir);
    // First block should pass (CREATE outside scope is ok)
    // Second block should fail (ignored path)
    expect(errors.length).toBe(1);
    expect(errors[0].message).toContain('ignored');
  });
});
