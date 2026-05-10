import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { applyChanges } from '../src';
import { ApplyPlan } from '@inscribe/shared';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('Applier', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'inscribe-test-'));
    fs.mkdirSync(path.join(tempDir, 'app'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should create a new file', () => {
    const plan: ApplyPlan = {
      operations: [
        {
          type: 'create',
          file: 'app/new.txt',
          content: 'console.log("new");',
        },
      ],
    };

    const result = applyChanges(plan, tempDir);
    
    expect(result.success).toBe(true);
    const filePath = path.join(tempDir, 'app', 'new.txt');
    expect(fs.existsSync(filePath)).toBe(true);
    expect(fs.readFileSync(filePath, 'utf-8')).toBe('console.log("new");');
  });

  it('should replace file content', () => {
    const filePath = path.join(tempDir, 'app', 'existing.txt');
    fs.writeFileSync(filePath, 'old content');

    const plan: ApplyPlan = {
      operations: [
        {
          type: 'replace',
          file: 'app/existing.txt',
          content: 'new content',
        },
      ],
    };

    const result = applyChanges(plan, tempDir);
    
    expect(result.success).toBe(true);
    expect(fs.readFileSync(filePath, 'utf-8')).toBe('new content');
  });

  it('should append to file', () => {
    const filePath = path.join(tempDir, 'app', 'existing.txt');
    fs.writeFileSync(filePath, 'original');

    const plan: ApplyPlan = {
      operations: [
        {
          type: 'append',
          file: 'app/existing.txt',
          content: ' appended',
        },
      ],
    };

    const result = applyChanges(plan, tempDir);
    
    expect(result.success).toBe(true);
    expect(fs.readFileSync(filePath, 'utf-8')).toBe('original appended');
  });

  it('should apply range replace', () => {
    const filePath = path.join(tempDir, 'app', 'range.txt');
    fs.writeFileSync(filePath, `// start
old content
// end
`);

    const plan: ApplyPlan = {
      operations: [
        {
          type: 'range',
          file: 'app/range.txt',
          content: 'new content',
          directives: {
            START_AFTER: '// start',
            END_BEFORE: '// end',
          },
        },
      ],
    };

    const result = applyChanges(plan, tempDir);
    
    expect(result.success).toBe(true);
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('new content');
    expect(content).toContain('// start');
    expect(content).toContain('// end');
    expect(content).not.toContain('old content');
  });

  it('should apply range replace including anchors', () => {
    const filePath = path.join(tempDir, 'app', 'range-inclusive.txt');
    fs.writeFileSync(filePath, `// start
old content
// end
keep
`);

    const plan: ApplyPlan = {
      operations: [
        {
          type: 'range',
          file: 'app/range-inclusive.txt',
          content: 'new content',
          directives: {
            START: '// start',
            END: '// end',
          },
        },
      ],
    };

    const result = applyChanges(plan, tempDir);

    expect(result.success).toBe(true);
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('new content');
    expect(content).not.toContain('// start');
    expect(content).not.toContain('// end');
    expect(content).toContain('keep');
  });

  it('should expand range boundaries to full lines for substring anchors', () => {
    const filePath = path.join(tempDir, 'app', 'range-inline.txt');
    fs.writeFileSync(filePath, `alpha foo beta
charlie bar delta
omega
`);

    const plan: ApplyPlan = {
      operations: [
        {
          type: 'range',
          file: 'app/range-inline.txt',
          content: 'new content\n',
          directives: {
            START: 'foo',
            END: 'bar',
          },
        },
      ],
    };

    const result = applyChanges(plan, tempDir);

    expect(result.success).toBe(true);
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toBe(`new content
omega
`);
  });

  it('should not splice mid-line for range directives', () => {
    const filePath = path.join(tempDir, 'app', 'range-inline-after.txt');
    fs.writeFileSync(filePath, `alpha foo beta
charlie bar delta
omega
`);

    const plan: ApplyPlan = {
      operations: [
        {
          type: 'range',
          file: 'app/range-inline-after.txt',
          content: 'new content\n',
          directives: {
            START_AFTER: 'foo',
            END_BEFORE: 'omega',
          },
        },
      ],
    };

    const result = applyChanges(plan, tempDir);

    expect(result.success).toBe(true);
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toBe(`alpha foo beta
new content
omega
`);
  });

  it('should resolve END: } using START to select the first brace in the anchor line', () => {
    const filePath = path.join(tempDir, 'app', 'range-braces-start.txt');
    fs.writeFileSync(
      filePath,
      `const before = {
  old: true
};
const after = {
  keep: true
};
`
    );

    const plan: ApplyPlan = {
      operations: [
        {
          type: 'range',
          file: 'app/range-braces-start.txt',
          content: `const before = {\n  updated: true\n};\n`,
          directives: {
            START: 'const before = {',
            END: '}',
          },
        },
      ],
    };

    const result = applyChanges(plan, tempDir);

    expect(result.success).toBe(true);
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('updated: true');
    expect(content).toContain('const after');
    expect(content).not.toContain('old: true');
  });

  it('should resolve END: } using START_AFTER to select the next brace after the anchor', () => {
    const filePath = path.join(tempDir, 'app', 'range-braces-start-after.txt');
    fs.writeFileSync(
      filePath,
      `const before = {
  keep: true
};
START_MARK
const after = {
  old: true
};
`
    );

    const plan: ApplyPlan = {
      operations: [
        {
          type: 'range',
          file: 'app/range-braces-start-after.txt',
          content: `const after = {\n  updated: true\n};\n`,
          directives: {
            START_AFTER: 'START_MARK',
            END: '}',
          },
        },
      ],
    };

    const result = applyChanges(plan, tempDir);

    expect(result.success).toBe(true);
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('updated: true');
    expect(content).toContain('keep: true');
    expect(content).not.toContain('old: true');
  });

  it('should resolve END: } using START_BEFORE to pick the brace just before the anchor', () => {
    const filePath = path.join(tempDir, 'app', 'range-braces-start-before.txt');
    fs.writeFileSync(
      filePath,
      `function demo(){START_MARK
  old = true;
}
const after = {
  keep: true
};
`
    );

    const plan: ApplyPlan = {
      operations: [
        {
          type: 'range',
          file: 'app/range-braces-start-before.txt',
          content: `function demo(){\n  updated = true;\n}\n`,
          directives: {
            START_BEFORE: 'START_MARK',
            END: '}',
          },
        },
      ],
    };

    const result = applyChanges(plan, tempDir);

    expect(result.success).toBe(true);
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('updated = true');
    expect(content).toContain('const after');
    expect(content).not.toContain('old = true');
  });

  it('should resolve END: } when START is outside brace scope but followed by a block', () => {
    const filePath = path.join(tempDir, 'app', 'range-braces-outside.txt');
    fs.writeFileSync(
      filePath,
      `// start
const wrapper = {
  old: true
};
const after = 3;
`
    );

    const plan: ApplyPlan = {
      operations: [
        {
          type: 'range',
          file: 'app/range-braces-outside.txt',
          content: `const wrapper = {\n  updated: true\n};\n`,
          directives: {
            START_AFTER: '// start',
            END: '}',
          },
        },
      ],
    };

    const result = applyChanges(plan, tempDir);

    expect(result.success).toBe(true);
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('updated: true');
    expect(content).toContain('const after = 3;');
    expect(content).not.toContain('old: true');
  });

  it('should resolve END: } to the first brace after START, not the enclosing brace', () => {
    const filePath = path.join(tempDir, 'app', 'range-braces-nested.txt');
    fs.writeFileSync(
      filePath,
      `function outer() {
  // start
  if (flag) {
    old line
  }
  after
}
`
    );

    const plan: ApplyPlan = {
      operations: [
        {
          type: 'range',
          file: 'app/range-braces-nested.txt',
          content: `  if (flag) {\n    updated line\n  }\n`,
          directives: {
            START_AFTER: '// start',
            END: '}',
          },
        },
      ],
    };

    const result = applyChanges(plan, tempDir);

    expect(result.success).toBe(true);
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('updated line');
    expect(content).toContain('after');
    expect(content).toContain('function outer()');
    expect(content).not.toContain('old line');
  });

  it.skip('should ignore braces inside strings and comments for END: }', () => {
    const filePath = path.join(tempDir, 'app', 'range-braces-strings.txt');
    fs.writeFileSync(
      filePath,
      `function demo() {
  // start
  const text = "}";
  /* comment { */
  const inner = {
    old: true
  };
}
after
`
    );

    const plan: ApplyPlan = {
      operations: [
        {
          type: 'range',
          file: 'app/range-braces-strings.txt',
          content: `  const inner = {\n    updated: true\n  };\n`,
          directives: {
            START_AFTER: '// start',
            END: '}',
          },
        },
      ],
    };

    const result = applyChanges(plan, tempDir);

    expect(result.success).toBe(true);
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('updated: true');
    expect(content).toContain('after');
    expect(content).toContain('function demo()');
    expect(content).not.toContain('old: true');
  });

  it.skip('should ignore braces inside parameter lists for END: }', () => {
    const filePath = path.join(tempDir, 'app', 'range-braces-params.txt');
    fs.writeFileSync(
      filePath,
      `export default function AppLayout({ children, breadcrumbs = [], headerActions }: AppLayoutProps) {
  // start
  const state = { old: true };
}
after
`
    );

    const plan: ApplyPlan = {
      operations: [
        {
          type: 'range',
          file: 'app/range-braces-params.txt',
          content: `  const state = { updated: true };\n`,
          directives: {
            START: 'function AppLayout',
            END: '}',
          },
        },
      ],
    };

    const result = applyChanges(plan, tempDir);

    expect(result.success).toBe(true);
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('updated: true');
    expect(content).toContain('after');
    expect(content).toContain('export default function AppLayout');
    expect(content).not.toContain('old: true');
  });

  it.skip('should error when no opening brace exists in the selected range', () => {
    const filePath = path.join(tempDir, 'app', 'range-braces-missing.txt');
    fs.writeFileSync(
      filePath,
      `// start
const value = 1;
`
    );

    const plan: ApplyPlan = {
      operations: [
        {
          type: 'range',
          file: 'app/range-braces-missing.txt',
          content: 'const value = 2;\n',
          directives: {
            START_AFTER: '// start',
            END: '}',
          },
        },
      ],
    };

    const result = applyChanges(plan, tempDir);

    expect(result.success).toBe(false);
    expect(result.errors?.[0]).toContain('No opening brace found in the selected range');
  });

  it('should preserve non-brace END anchors unchanged', () => {
    const filePath = path.join(tempDir, 'app', 'range-non-brace-end.txt');
    fs.writeFileSync(
      filePath,
      `// start
old content
// end
`
    );

    const plan: ApplyPlan = {
      operations: [
        {
          type: 'range',
          file: 'app/range-non-brace-end.txt',
          content: 'new content',
          directives: {
            START_AFTER: '// start',
            END_BEFORE: '// end',
          },
        },
      ],
    };

    const result = applyChanges(plan, tempDir);

    expect(result.success).toBe(true);
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('new content');
    expect(content).toContain('// end');
    expect(content).not.toContain('old content');
  });

  it('should generate restore history entries', () => {
    const filePath = path.join(tempDir, 'app', 'existing.txt');
    fs.writeFileSync(filePath, 'original content');

    const plan: ApplyPlan = {
      operations: [
        {
          type: 'replace',
          file: 'app/existing.txt',
          content: 'new content',
        },
      ],
    };

    const result = applyChanges(plan, tempDir);
    
    expect(result.success).toBe(true);
    expect(result.historyEntries?.length).toBe(1);
    expect(result.historyEntries?.[0].restoreOperation.type).toBe('replace');
  });

  it('should handle multiple operations atomically', () => {
    const plan: ApplyPlan = {
      operations: [
        {
          type: 'create',
          file: 'app/file1.txt',
          content: 'content1',
        },
        {
          type: 'create',
          file: 'app/file2.txt',
          content: 'content2',
        },
      ],
    };

    const result = applyChanges(plan, tempDir);
    
    expect(result.success).toBe(true);
    expect(fs.existsSync(path.join(tempDir, 'app', 'file1.txt'))).toBe(true);
    expect(fs.existsSync(path.join(tempDir, 'app', 'file2.txt'))).toBe(true);
  });

  it('should fail when operations are empty', () => {
    const plan: ApplyPlan = {
      operations: [],
    };

    const result = applyChanges(plan, tempDir);

    expect(result.success).toBe(false);
    expect(result.errors?.[0]).toContain('No operations');
  });

  it('should delete an existing file', () => {
    const filePath = path.join(tempDir, 'app', 'to-delete.txt');
    fs.writeFileSync(filePath, 'content to delete');

    const plan: ApplyPlan = {
      operations: [
        {
          type: 'delete',
          file: 'app/to-delete.txt',
          content: '',
        },
      ],
    };

    const result = applyChanges(plan, tempDir);

    expect(result.success).toBe(true);
    expect(fs.existsSync(filePath)).toBe(false);
  });

  it('should delete file and clean up empty parent directories', () => {
    const nestedDir = path.join(tempDir, 'app', 'nested', 'deep');
    fs.mkdirSync(nestedDir, { recursive: true });
    const filePath = path.join(nestedDir, 'file.txt');
    fs.writeFileSync(filePath, 'content');
    
    // Create another file in app to prevent it from being deleted
    fs.writeFileSync(path.join(tempDir, 'app', 'other.txt'), 'other content');

    const plan: ApplyPlan = {
      operations: [
        {
          type: 'delete',
          file: 'app/nested/deep/file.txt',
          content: '',
        },
      ],
    };

    const result = applyChanges(plan, tempDir);

    expect(result.success).toBe(true);
    expect(fs.existsSync(filePath)).toBe(false);
    // Empty parent directories should be cleaned up
    expect(fs.existsSync(nestedDir)).toBe(false);
    expect(fs.existsSync(path.join(tempDir, 'app', 'nested'))).toBe(false);
    // But app directory should still exist because it has other.js
    expect(fs.existsSync(path.join(tempDir, 'app'))).toBe(true);
    expect(fs.existsSync(path.join(tempDir, 'app', 'other.txt'))).toBe(true);
  });

  it('should not remove non-empty parent directories when deleting', () => {
    const nestedDir = path.join(tempDir, 'app', 'nested');
    fs.mkdirSync(nestedDir, { recursive: true });
    const file1Path = path.join(nestedDir, 'file1.txt');
    const file2Path = path.join(nestedDir, 'file2.txt');
    fs.writeFileSync(file1Path, 'content1');
    fs.writeFileSync(file2Path, 'content2');

    const plan: ApplyPlan = {
      operations: [
        {
          type: 'delete',
          file: 'app/nested/file1.txt',
          content: '',
        },
      ],
    };

    const result = applyChanges(plan, tempDir);

    expect(result.success).toBe(true);
    expect(fs.existsSync(file1Path)).toBe(false);
    expect(fs.existsSync(file2Path)).toBe(true);
    expect(fs.existsSync(nestedDir)).toBe(true);
  });


  it('should fail when operation type is unknown', () => {
    const plan: ApplyPlan = {
      operations: [
        {
          type: 'invalid' as any,
          file: 'app/unknown.txt',
          content: 'content',
        },
      ],
    };

    const result = applyChanges(plan, tempDir);

    expect(result.success).toBe(false);
    expect(result.errors?.[0]).toContain('Unknown operation type');
  });

  it('should fail when plan contains errors', () => {
    const plan: ApplyPlan = {
      operations: [
        {
          type: 'create',
          file: 'app/new.txt',
          content: 'content',
        },
      ],
      errors: [
        {
          blockIndex: 0,
          file: 'app/new.txt',
          message: 'validation failed',
        },
      ],
    };

    const result = applyChanges(plan, tempDir);

    expect(result.success).toBe(false);
    expect(result.errors?.[0]).toContain('validation failed');
    expect(fs.existsSync(path.join(tempDir, 'app', 'new.txt'))).toBe(false);
  });

  it('should reject apply operations that escape the repo root', () => {
    const escapedPath = path.join(tempDir, '..', 'inscribe-escape.txt');
    if (fs.existsSync(escapedPath)) {
      fs.rmSync(escapedPath, { force: true });
    }

    const plan: ApplyPlan = {
      operations: [
        {
          type: 'create',
          file: '../inscribe-escape.txt',
          content: 'content',
        },
      ],
    };

    const result = applyChanges(plan, tempDir);

    expect(result.success).toBe(false);
    expect(result.errors?.[0]).toContain('outside repository root');
    expect(fs.existsSync(escapedPath)).toBe(false);
  });

  it('should reject apply operations that target ignored paths', () => {
    fs.writeFileSync(path.join(tempDir, '.inscribeignore'), 'ignored-dir/');

    const plan: ApplyPlan = {
      operations: [
        {
          type: 'create',
          file: 'ignored-dir/new.txt',
          content: 'content',
        },
      ],
    };

    const result = applyChanges(plan, tempDir);

    expect(result.success).toBe(false);
    expect(result.errors?.[0]).toContain('ignored path');
    expect(fs.existsSync(path.join(tempDir, 'ignored-dir', 'new.txt'))).toBe(false);
  });

  it('should fail range apply when anchors are missing', () => {
    const filePath = path.join(tempDir, 'app', 'range.txt');
    fs.writeFileSync(filePath, 'content');

    const plan: ApplyPlan = {
      operations: [
        {
          type: 'range',
          file: 'app/range.txt',
          content: 'new',
          directives: {
            END: '// end',
          },
        } as any,
      ],
    };

    const result = applyChanges(plan, tempDir);

    expect(result.success).toBe(false);
    expect(result.errors?.[0]).toContain('Range operation requires exactly one of START');
  });

  it('should replace a single line when END anchor is missing', () => {
    const filePath = path.join(tempDir, 'app', 'range.txt');
    fs.writeFileSync(filePath, `// start\nold line\nnext line\n`);

    const plan: ApplyPlan = {
      operations: [
        {
          type: 'range',
          file: 'app/range.txt',
          content: 'replacement\nline',
          directives: {
            START: '// start',
          },
        } as any,
      ],
    };

    const result = applyChanges(plan, tempDir);

    expect(result.success).toBe(true);
    const updated = fs.readFileSync(filePath, 'utf-8');
    expect(updated).toBe(`replacement\nline\nold line\nnext line\n`);
  });

  it('should replace the line after START_AFTER when END is missing', () => {
    const filePath = path.join(tempDir, 'app', 'range-after.txt');
    fs.writeFileSync(filePath, `// start\nold line\nnext line\n`);

    const plan: ApplyPlan = {
      operations: [
        {
          type: 'range',
          file: 'app/range-after.txt',
          content: 'inserted\n',
          directives: {
            START_AFTER: '// start',
          },
        },
      ],
    };

    const result = applyChanges(plan, tempDir);

    expect(result.success).toBe(true);
    const updated = fs.readFileSync(filePath, 'utf-8');
    expect(updated).toBe(`// start\ninserted\nnext line\n`);
  });

  it('should enforce unique anchors during range apply', () => {
    const filePath = path.join(tempDir, 'app', 'range.txt');
    fs.writeFileSync(filePath, '// start\ncontent\n// start\n// end');

    const plan: ApplyPlan = {
      operations: [
        {
          type: 'range',
          file: 'app/range.txt',
          content: 'new',
          directives: {
            START: '// start',
            END: '// end',
          },
        },
      ],
    };

    const result = applyChanges(plan, tempDir);

    expect(result.success).toBe(false);
    expect(result.errors?.[0]).toContain('START anchor matches multiple times');
  });

  it('should allow multiple END anchors', () => {
    const filePath = path.join(tempDir, 'app', 'range.txt');
    fs.writeFileSync(filePath, '// start\ncontent\n// end\n// end');

    const plan: ApplyPlan = {
      operations: [
        {
          type: 'range',
          file: 'app/range.txt',
          content: 'new',
          directives: {
            START_AFTER: '// start',
            END_BEFORE: '// end',
          },
        },
      ],
    };

    const result = applyChanges(plan, tempDir);

    expect(result.success).toBe(true);
    const updated = fs.readFileSync(filePath, 'utf-8');
    expect(updated).toContain('// end');
    expect(updated).toContain('new');
    expect(updated).not.toContain('content');
  });

  it.skip('should enforce scoped anchors during range apply', () => {
    const filePath = path.join(tempDir, 'app', 'range.txt');
    fs.writeFileSync(filePath, '// scope start\n// start\ncontent\n// end\n// scope end');

    const plan: ApplyPlan = {
      operations: [
        {
          type: 'range',
          file: 'app/range.txt',
          content: 'new content',
          directives: {
            START_AFTER: '// start',
            END_BEFORE: '// end',
            SCOPE_START: '// missing scope',
            SCOPE_END: '// scope end',
          },
        },
      ],
    };

    const result = applyChanges(plan, tempDir);

    expect(result.success).toBe(false);
    expect(result.errors?.[0]).toContain('SCOPE_START anchor not found');
  });

  it.skip('should fail when scope anchors are not unique', () => {
    const filePath = path.join(tempDir, 'app', 'range.txt');
    fs.writeFileSync(filePath, '// scope start\n// scope start\n// start\ncontent\n// end\n// scope end');

    const plan: ApplyPlan = {
      operations: [
        {
          type: 'range',
          file: 'app/range.txt',
          content: 'new content',
          directives: {
            START_AFTER: '// start',
            END_BEFORE: '// end',
            SCOPE_START: '// scope start',
            SCOPE_END: '// scope end',
          },
        },
      ],
    };

    const result = applyChanges(plan, tempDir);

    expect(result.success).toBe(false);
    expect(result.errors?.[0]).toContain('SCOPE_START anchor matches multiple times');
  });

  it.skip('should replace content within range and preserve anchors', () => {
    const filePath = path.join(tempDir, 'app', 'range.txt');
    fs.writeFileSync(filePath, '// scope start\n// start\nold content\n// end\n// scope end');

    const plan: ApplyPlan = {
      operations: [
        {
          type: 'range',
          file: 'app/range.txt',
          content: 'new content',
          directives: {
            START_AFTER: '// start',
            END_BEFORE: '// end',
            SCOPE_START: '// scope start',
            SCOPE_END: '// scope end',
          },
        },
      ],
    };

    const result = applyChanges(plan, tempDir);

    expect(result.success).toBe(true);
    const updated = fs.readFileSync(filePath, 'utf-8');
    expect(updated).toContain('// start');
    expect(updated).toContain('// end');
    expect(updated).toContain('new content');
    expect(updated).not.toContain('old content');
  });

  it.skip('should allow multiple SCOPE_END anchors', () => {
    const filePath = path.join(tempDir, 'app', 'range.txt');
    fs.writeFileSync(filePath, '// scope start\n// start\nold\n// end\n// scope end\n// scope end');

    const plan: ApplyPlan = {
      operations: [
        {
          type: 'range',
          file: 'app/range.txt',
          content: 'new',
          directives: {
            START_AFTER: '// start',
            END_BEFORE: '// end',
            SCOPE_START: '// scope start',
            SCOPE_END: '// scope end',
          },
        },
      ],
    };

    const result = applyChanges(plan, tempDir);

    expect(result.success).toBe(true);
    const updated = fs.readFileSync(filePath, 'utf-8');
    expect(updated).toContain('new');
    expect(updated).toContain('// scope end');
  });
});
