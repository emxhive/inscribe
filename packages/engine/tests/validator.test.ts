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
      path.join(tempDir, 'app', 'existing.txt'),
      'console.log("existing");'
    );
    
    // Create a file with range markers
    fs.writeFileSync(
      path.join(tempDir, 'app', 'range-test.txt'),
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
        file: 'app/new.txt',
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
        file: 'app/existing.txt',
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
        file: 'app/existing.txt',
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
        file: 'app/missing.txt',
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
        file: 'other/file.txt',
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
        file: '../outside/file.txt',
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

  it('allows replace mode outside configured scope', () => {
    setScopeState(tempDir, ['app']);
    
    // Create a file outside scope
    fs.mkdirSync(path.join(tempDir, 'other'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'other', 'file.txt'), 'content');

    const blocks: ParsedBlock[] = [
      {
        file: 'other/file.txt',
        mode: 'replace',
        directives: {},
        content: 'new content',
        blockIndex: 0,
      },
    ];

    const errors = validateBlocks(blocks, tempDir);
    expect(errors).toEqual([]);
  });

  it('allows append mode outside configured scope', () => {
    setScopeState(tempDir, ['app']);
    
    // Create a file outside scope
    fs.mkdirSync(path.join(tempDir, 'other'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'other', 'file.txt'), 'content');

    const blocks: ParsedBlock[] = [
      {
        file: 'other/file.txt',
        mode: 'append',
        directives: {},
        content: 'more content',
        blockIndex: 0,
      },
    ];

    const errors = validateBlocks(blocks, tempDir);
    expect(errors).toEqual([]);
  });

  it('allows range mode outside configured scope', () => {
    setScopeState(tempDir, ['app']);
    
    // Create a file outside scope
    fs.mkdirSync(path.join(tempDir, 'other'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'other', 'file.txt'), '// start\nold\n// end\n');

    const blocks: ParsedBlock[] = [
      {
        file: 'other/file.txt',
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

  it('rejects non-create modes in ignored paths', () => {
    fs.mkdirSync(path.join(tempDir, 'ignored'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'ignored', 'file.txt'), 'content');
    fs.writeFileSync(path.join(tempDir, '.inscribeignore'), 'ignored/');

    const blocks: ParsedBlock[] = [
      {
        file: 'ignored/file.txt',
        mode: 'replace',
        directives: {},
        content: 'new content',
        blockIndex: 0,
      },
    ];

    const errors = validateBlocks(blocks, tempDir);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toContain('ignored');
  });

  it('should validate range mode with valid anchors', () => {
    const blocks: ParsedBlock[] = [
      {
        file: 'app/range-test.txt',
        mode: 'range',
        directives: {
          START_AFTER: '// start',
          END_BEFORE: '// end',
        },
        content: 'new content',
        blockIndex: 0,
      },
    ];

    const errors = validateBlocks(blocks, tempDir);
    expect(errors).toEqual([]);
  });

  it('should validate range mode with START-only anchors', () => {
    const blocks: ParsedBlock[] = [
      {
        file: 'app/range-test.txt',
        mode: 'range',
        directives: {
          START: '// start',
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
        file: 'app/range-test.txt',
        mode: 'range',
        directives: {
          END_BEFORE: '// end',
        },
        content: 'content',
        blockIndex: 0,
      },
    ];

    const errors = validateBlocks(blocks, tempDir);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toContain('START_BEFORE');
  });

  it('should fail range mode with non-matching anchor', () => {
    const blocks: ParsedBlock[] = [
      {
        file: 'app/range-test.txt',
        mode: 'range',
        directives: {
          START_AFTER: '// nonexistent',
          END_BEFORE: '// end',
        },
        content: 'content',
        blockIndex: 0,
      },
    ];

    const errors = validateBlocks(blocks, tempDir);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toContain('not found');
  });

  it('allows range mode with multiple END anchors after START', () => {
    fs.writeFileSync(
      path.join(tempDir, 'app', 'range-multi-end.txt'),
      `// start
const x = 1;
// end
// end
`
    );

    const blocks: ParsedBlock[] = [
      {
        file: 'app/range-multi-end.txt',
        mode: 'range',
        directives: {
          START_AFTER: '// start',
          END_BEFORE: '// end',
        },
        content: 'new content',
        blockIndex: 0,
      },
    ];

    const errors = validateBlocks(blocks, tempDir);
    expect(errors).toEqual([]);
  });

  it('rejects range mode when END is only before START', () => {
    fs.writeFileSync(
      path.join(tempDir, 'app', 'range-end-before.txt'),
      `// end
// start
const x = 1;
`
    );

    const blocks: ParsedBlock[] = [
      {
        file: 'app/range-end-before.txt',
        mode: 'range',
        directives: {
          START_AFTER: '// start',
          END_BEFORE: '// end',
        },
        content: 'new content',
        blockIndex: 0,
      },
    ];

    const errors = validateBlocks(blocks, tempDir);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toContain('not found after');
  });

  it('uses CONTAINS to disambiguate duplicate START anchors', () => {
    fs.writeFileSync(
      path.join(tempDir, 'app', 'range-contains.txt'),
      `return row(
  title: 'transaction',
);

return row(
  title: 'composition',
  direction: neutral,
);

return row(
  title: 'other',
);
`
    );

    const blocks: ParsedBlock[] = [
      {
        file: 'app/range-contains.txt',
        mode: 'range',
        directives: {
          START: 'return row(',
          CONTAINS: 'direction: neutral',
          END_AFTER: ');',
        },
        content: '',
        blockIndex: 0,
      },
    ];

    const errors = validateBlocks(blocks, tempDir);
    expect(errors).toEqual([]);
  });

  it('rejects duplicate START anchors that remain ambiguous after CONTAINS filters', () => {
    fs.writeFileSync(
      path.join(tempDir, 'app', 'range-contains-ambiguous.txt'),
      `return row(
  direction: neutral,
);

return row(
  direction: neutral,
);
`
    );

    const blocks: ParsedBlock[] = [
      {
        file: 'app/range-contains-ambiguous.txt',
        mode: 'range',
        directives: {
          START: 'return row(',
          CONTAINS: 'direction: neutral',
          END_AFTER: ');',
        },
        content: '',
        blockIndex: 0,
      },
    ];

    const errors = validateBlocks(blocks, tempDir);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toContain('START anchor matches multiple times (2)');
  });

  it.skip('rejects END: } when no opening brace exists in the selected range', () => {
    fs.writeFileSync(
      path.join(tempDir, 'app', 'range-brace-outside.txt'),
      `// start
const x = 1;
`
    );

    const blocks: ParsedBlock[] = [
      {
        file: 'app/range-brace-outside.txt',
        mode: 'range',
        directives: {
          START: '// start',
          END: '}',
        },
        content: 'new content',
        blockIndex: 0,
      },
    ];

    const errors = validateBlocks(blocks, tempDir);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toContain('No opening brace found in the selected range');
  });

  it.skip('rejects END: } when closing brace is missing', () => {
    fs.writeFileSync(
      path.join(tempDir, 'app', 'range-brace-missing.txt'),
      `// start
function demo() {
  const x = 1;
`
    );

    const blocks: ParsedBlock[] = [
      {
        file: 'app/range-brace-missing.txt',
        mode: 'range',
        directives: {
          START_AFTER: '// start',
          END: '}',
        },
        content: 'new content',
        blockIndex: 0,
      },
    ];

    const errors = validateBlocks(blocks, tempDir);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toContain('Missing closing brace');
  });

  it.skip('allows scope with non-unique SCOPE_END', () => {
    fs.writeFileSync(
      path.join(tempDir, 'app', 'range-scope.txt'),
      `// scope start
// start
const x = 1;
// end
// scope end
// scope end
`
    );

    const blocks: ParsedBlock[] = [
      {
        file: 'app/range-scope.txt',
        mode: 'range',
        directives: {
          START_AFTER: '// start',
          END_BEFORE: '// end',
          SCOPE_START: '// scope start',
          SCOPE_END: '// scope end',
        },
        content: 'new content',
        blockIndex: 0,
      },
    ];

    const errors = validateBlocks(blocks, tempDir);
    expect(errors).toEqual([]);
  });

  it('falls back to whitespace-insensitive anchor matching', () => {
    fs.writeFileSync(
      path.join(tempDir, 'app', 'range-whitespace.txt'),
      `// start   marker
const x = 1;
// end marker
`
    );

    const blocks: ParsedBlock[] = [
      {
        file: 'app/range-whitespace.txt',
        mode: 'range',
        directives: {
          START_AFTER: '// start marker',
          END_BEFORE: '// end marker',
        },
        content: 'new content',
        blockIndex: 0,
      },
    ];

    const errors = validateBlocks(blocks, tempDir);
    expect(errors).toEqual([]);
  });

  it('should validate delete mode with existing file', () => {
    const blocks: ParsedBlock[] = [
      {
        file: 'app/existing.txt',
        mode: 'delete',
        directives: {},
        content: '',
        blockIndex: 0,
      },
    ];

    const errors = validateBlocks(blocks, tempDir);
    expect(errors).toEqual([]);
  });

  it('should fail delete mode with non-existing file', () => {
    const blocks: ParsedBlock[] = [
      {
        file: 'app/missing.txt',
        mode: 'delete',
        directives: {},
        content: '',
        blockIndex: 0,
      },
    ];

    const errors = validateBlocks(blocks, tempDir);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toContain('does not exist');
  });

  it('allows delete mode outside configured scope', () => {
    setScopeState(tempDir, ['app']);
    
    // Create a file outside scope
    fs.mkdirSync(path.join(tempDir, 'other'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'other', 'file.txt'), 'content');

    const blocks: ParsedBlock[] = [
      {
        file: 'other/file.txt',
        mode: 'delete',
        directives: {},
        content: '',
        blockIndex: 0,
      },
    ];

    const errors = validateBlocks(blocks, tempDir);
    expect(errors).toEqual([]);
  });

  it('should reject delete mode in ignored paths', () => {
    fs.mkdirSync(path.join(tempDir, 'ignored'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'ignored', 'file.txt'), 'content');
    fs.writeFileSync(path.join(tempDir, '.inscribeignore'), 'ignored/');

    const blocks: ParsedBlock[] = [
      {
        file: 'ignored/file.txt',
        mode: 'delete',
        directives: {},
        content: '',
        blockIndex: 0,
      },
    ];

    const errors = validateBlocks(blocks, tempDir);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toContain('ignored');
  });

  it('should reject delete mode outside repo root', () => {
    setScopeState(tempDir, ['app']);

    const blocks: ParsedBlock[] = [
      {
        file: '../outside/file.txt',
        mode: 'delete',
        directives: {},
        content: '',
        blockIndex: 0,
      },
    ];

    const errors = validateBlocks(blocks, tempDir);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toContain('outside repository root');
  });
});
