import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setScopeState, validateBlocks } from '../src';
import { ParsedBlock } from '@inscribe/shared';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('Validator', () => {
  let tempDir: string;

  beforeEach(() => {
    // Create a temporary directory for testing
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'inscribe-test-'));
    
    // Create indexed roots
    fs.mkdirSync(path.join(tempDir, 'app'), { recursive: true });
    fs.mkdirSync(path.join(tempDir, 'tests'), { recursive: true });
    
    // Create a test file
    fs.writeFileSync(
      path.join(tempDir, 'app', 'existing.js'),
      'console.log("existing");'
    );
    
    // Create a file with range markers
    fs.writeFileSync(
      path.join(tempDir, 'app', 'range-test.js'),
      `// start
const x = 1;
// end
`
    );
  });

  afterEach(() => {
    // Clean up
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should validate create mode with non-existing file', () => {
    const blocks: ParsedBlock[] = [
      {
        file: 'app/new.js',
        mode: 'create',
        directives: {},
        content: 'console.log("new");',
        blockIndex: 0,
      },
    ];

    const errors = validateBlocks(blocks, tempDir);
    expect(errors).toEqual([]);
  });

  it('should fail create mode with existing file', () => {
    const blocks: ParsedBlock[] = [
      {
        file: 'app/existing.js',
        mode: 'create',
        directives: {},
        content: 'content',
        blockIndex: 0,
      },
    ];

    const errors = validateBlocks(blocks, tempDir);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toContain('already exists');
  });

  it('should validate replace mode with existing file', () => {
    const blocks: ParsedBlock[] = [
      {
        file: 'app/existing.js',
        mode: 'replace',
        directives: {},
        content: 'new content',
        blockIndex: 0,
      },
    ];

    const errors = validateBlocks(blocks, tempDir);
    expect(errors).toEqual([]);
  });

  it('should fail replace mode with non-existing file', () => {
    const blocks: ParsedBlock[] = [
      {
        file: 'app/missing.js',
        mode: 'replace',
        directives: {},
        content: 'content',
        blockIndex: 0,
      },
    ];

    const errors = validateBlocks(blocks, tempDir);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toContain('does not exist');
  });

  it('should allow create mode outside indexed roots (but not ignored)', () => {
    // This test verifies that CREATE mode can create files outside scope
    const blocks: ParsedBlock[] = [
      {
        file: 'other/file.js',
        mode: 'create',
        directives: {},
        content: 'content',
        blockIndex: 0,
      },
    ];

    const errors = validateBlocks(blocks, tempDir);
    // Should pass - CREATE is allowed outside scope as long as not ignored
    expect(errors).toEqual([]);
  });

  it('should reject create mode in ignored paths', () => {
    fs.mkdirSync(path.join(tempDir, 'src'), { recursive: true });
    fs.mkdirSync(path.join(tempDir, '.git'), { recursive: true });
    setScopeState(tempDir, ['src']);

    const blocks: ParsedBlock[] = [
      {
        file: 'src/../.git/config',
        mode: 'create',
        directives: {},
        content: 'content',
        blockIndex: 0,
      },
    ];

    const errors = validateBlocks(blocks, tempDir);
    expect(errors.length).toBeGreaterThan(0);
    // Should fail because .git/ is an ignored path
    expect(errors.some(error => error.message.includes('ignored'))).toBe(true);
  });

  it('should reject create mode outside repo root', () => {
    setScopeState(tempDir, ['app']);

    const blocks: ParsedBlock[] = [
      {
        file: '../outside/file.js',
        mode: 'create',
        directives: {},
        content: 'content',
        blockIndex: 0,
      },
    ];

    const errors = validateBlocks(blocks, tempDir);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toContain('outside repository root');
  });

  it('should enforce scope restriction for replace mode', () => {
    setScopeState(tempDir, ['app']);
    
    // Create a file outside scope
    fs.mkdirSync(path.join(tempDir, 'other'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'other', 'file.js'), 'content');

    const blocks: ParsedBlock[] = [
      {
        file: 'other/file.js',
        mode: 'replace',
        directives: {},
        content: 'new content',
        blockIndex: 0,
      },
    ];

    const errors = validateBlocks(blocks, tempDir);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toContain('scope roots');
  });

  it('should enforce scope restriction for append mode', () => {
    setScopeState(tempDir, ['app']);
    
    // Create a file outside scope
    fs.mkdirSync(path.join(tempDir, 'other'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'other', 'file.js'), 'content');

    const blocks: ParsedBlock[] = [
      {
        file: 'other/file.js',
        mode: 'append',
        directives: {},
        content: 'more content',
        blockIndex: 0,
      },
    ];

    const errors = validateBlocks(blocks, tempDir);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toContain('scope roots');
  });

  it('should enforce scope restriction for range mode', () => {
    setScopeState(tempDir, ['app']);
    
    // Create a file outside scope
    fs.mkdirSync(path.join(tempDir, 'other'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'other', 'file.js'), '// start\nold\n// end\n');

    const blocks: ParsedBlock[] = [
      {
        file: 'other/file.js',
        mode: 'range',
        directives: {
          START: '// start',
          END: '// end',
        },
        content: 'new content',
        blockIndex: 0,
      },
    ];

    const errors = validateBlocks(blocks, tempDir);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toContain('scope roots');
  });

  it('should validate range mode with valid anchors', () => {
    const blocks: ParsedBlock[] = [
      {
        file: 'app/range-test.js',
        mode: 'range',
        directives: {
          START: '// start',
          END: '// end',
        },
        content: 'new content',
        blockIndex: 0,
      },
    ];

    const errors = validateBlocks(blocks, tempDir);
    expect(errors).toEqual([]);
  });

  it('should fail range mode without START directive', () => {
    const blocks: ParsedBlock[] = [
      {
        file: 'app/range-test.js',
        mode: 'range',
        directives: {
          END: '// end',
        },
        content: 'content',
        blockIndex: 0,
      },
    ];

    const errors = validateBlocks(blocks, tempDir);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toContain('START');
  });

  it('should fail range mode with non-matching anchor', () => {
    const blocks: ParsedBlock[] = [
      {
        file: 'app/range-test.js',
        mode: 'range',
        directives: {
          START: '// nonexistent',
          END: '// end',
        },
        content: 'content',
        blockIndex: 0,
      },
    ];

    const errors = validateBlocks(blocks, tempDir);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toContain('not found');
  });
});
