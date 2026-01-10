import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { applyChanges, undoLastApply } from '../src';
import { ApplyPlan } from '@shared';
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
          file: 'app/new.js',
          content: 'console.log("new");',
        },
      ],
    };

    const result = applyChanges(plan, tempDir);
    
    expect(result.success).toBe(true);
    expect(result.backupPath).toBeDefined();
    
    const filePath = path.join(tempDir, 'app', 'new.js');
    expect(fs.existsSync(filePath)).toBe(true);
    expect(fs.readFileSync(filePath, 'utf-8')).toBe('console.log("new");');
  });

  it('should replace file content', () => {
    const filePath = path.join(tempDir, 'app', 'existing.js');
    fs.writeFileSync(filePath, 'old content');

    const plan: ApplyPlan = {
      operations: [
        {
          type: 'replace',
          file: 'app/existing.js',
          content: 'new content',
        },
      ],
    };

    const result = applyChanges(plan, tempDir);
    
    expect(result.success).toBe(true);
    expect(fs.readFileSync(filePath, 'utf-8')).toBe('new content');
  });

  it('should append to file', () => {
    const filePath = path.join(tempDir, 'app', 'existing.js');
    fs.writeFileSync(filePath, 'original');

    const plan: ApplyPlan = {
      operations: [
        {
          type: 'append',
          file: 'app/existing.js',
          content: ' appended',
        },
      ],
    };

    const result = applyChanges(plan, tempDir);
    
    expect(result.success).toBe(true);
    expect(fs.readFileSync(filePath, 'utf-8')).toBe('original appended');
  });

  it('should apply range replace', () => {
    const filePath = path.join(tempDir, 'app', 'range.js');
    fs.writeFileSync(filePath, `// start
old content
// end
`);

    const plan: ApplyPlan = {
      operations: [
        {
          type: 'range',
          file: 'app/range.js',
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
    expect(content).toContain('// start');
    expect(content).toContain('// end');
    expect(content).not.toContain('old content');
  });

  it('should create backup before applying', () => {
    const filePath = path.join(tempDir, 'app', 'existing.js');
    fs.writeFileSync(filePath, 'original content');

    const plan: ApplyPlan = {
      operations: [
        {
          type: 'replace',
          file: 'app/existing.js',
          content: 'new content',
        },
      ],
    };

    const result = applyChanges(plan, tempDir);
    
    expect(result.success).toBe(true);
    expect(result.backupPath).toBeDefined();
    
    // Check backup exists
    const backupFilePath = path.join(result.backupPath!, 'app', 'existing.js');
    expect(fs.existsSync(backupFilePath)).toBe(true);
    expect(fs.readFileSync(backupFilePath, 'utf-8')).toBe('original content');
  });

  it('should undo last apply', () => {
    const filePath = path.join(tempDir, 'app', 'existing.js');
    fs.writeFileSync(filePath, 'original content');

    const plan: ApplyPlan = {
      operations: [
        {
          type: 'replace',
          file: 'app/existing.js',
          content: 'new content',
        },
      ],
    };

    // Apply changes
    const applyResult = applyChanges(plan, tempDir);
    expect(applyResult.success).toBe(true);
    expect(fs.readFileSync(filePath, 'utf-8')).toBe('new content');

    // Undo
    const undoResult = undoLastApply(tempDir);
    expect(undoResult.success).toBe(true);
    expect(fs.readFileSync(filePath, 'utf-8')).toBe('original content');
  });

  it('should handle multiple operations atomically', () => {
    const plan: ApplyPlan = {
      operations: [
        {
          type: 'create',
          file: 'app/file1.js',
          content: 'content1',
        },
        {
          type: 'create',
          file: 'app/file2.js',
          content: 'content2',
        },
      ],
    };

    const result = applyChanges(plan, tempDir);
    
    expect(result.success).toBe(true);
    expect(fs.existsSync(path.join(tempDir, 'app', 'file1.js'))).toBe(true);
    expect(fs.existsSync(path.join(tempDir, 'app', 'file2.js'))).toBe(true);
  });

  it('should fail when operations are empty', () => {
    const plan: ApplyPlan = {
      operations: [],
    };

    const result = applyChanges(plan, tempDir);

    expect(result.success).toBe(false);
    expect(result.errors?.[0]).toContain('No operations');
  });

  it('should fail when operation type is unknown', () => {
    const plan: ApplyPlan = {
      operations: [
        {
          type: 'delete' as any,
          file: 'app/unknown.js',
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
          file: 'app/new.js',
          content: 'content',
        },
      ],
      errors: [
        {
          blockIndex: 0,
          file: 'app/new.js',
          message: 'validation failed',
        },
      ],
    };

    const result = applyChanges(plan, tempDir);

    expect(result.success).toBe(false);
    expect(result.errors?.[0]).toContain('validation failed');
    expect(fs.existsSync(path.join(tempDir, 'app', 'new.js'))).toBe(false);
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

  it('should fail range apply when anchors are missing', () => {
    const filePath = path.join(tempDir, 'app', 'range.js');
    fs.writeFileSync(filePath, 'content');

    const plan: ApplyPlan = {
      operations: [
        {
          type: 'range',
          file: 'app/range.js',
          content: 'new',
          directives: {
            END: '// end',
          },
        } as any,
      ],
    };

    const result = applyChanges(plan, tempDir);

    expect(result.success).toBe(false);
    expect(result.errors?.[0]).toContain('Range operation requires START and END directives');
  });

  it('should fail range apply when END anchor is missing', () => {
    const filePath = path.join(tempDir, 'app', 'range.js');
    fs.writeFileSync(filePath, 'content');

    const plan: ApplyPlan = {
      operations: [
        {
          type: 'range',
          file: 'app/range.js',
          content: 'new',
          directives: {
            START: '// start',
          },
        } as any,
      ],
    };

    const result = applyChanges(plan, tempDir);

    expect(result.success).toBe(false);
    expect(result.errors?.[0]).toContain('Range operation requires START and END directives');
  });

  it('should enforce unique anchors during range apply', () => {
    const filePath = path.join(tempDir, 'app', 'range.js');
    fs.writeFileSync(filePath, '// start\ncontent\n// start\n// end');

    const plan: ApplyPlan = {
      operations: [
        {
          type: 'range',
          file: 'app/range.js',
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

  it('should fail when END anchor is not unique', () => {
    const filePath = path.join(tempDir, 'app', 'range.js');
    fs.writeFileSync(filePath, '// start\ncontent\n// end\n// end');

    const plan: ApplyPlan = {
      operations: [
        {
          type: 'range',
          file: 'app/range.js',
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
    expect(result.errors?.[0]).toContain('END anchor matches multiple times');
  });

  it('should enforce scoped anchors during range apply', () => {
    const filePath = path.join(tempDir, 'app', 'range.js');
    fs.writeFileSync(filePath, '// scope start\n// start\ncontent\n// end\n// scope end');

    const plan: ApplyPlan = {
      operations: [
        {
          type: 'range',
          file: 'app/range.js',
          content: 'new content',
          directives: {
            START: '// start',
            END: '// end',
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

  it('should fail when scope anchors are not unique', () => {
    const filePath = path.join(tempDir, 'app', 'range.js');
    fs.writeFileSync(filePath, '// scope start\n// scope start\n// start\ncontent\n// end\n// scope end');

    const plan: ApplyPlan = {
      operations: [
        {
          type: 'range',
          file: 'app/range.js',
          content: 'new content',
          directives: {
            START: '// start',
            END: '// end',
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

  it('should replace content within range and preserve anchors', () => {
    const filePath = path.join(tempDir, 'app', 'range.js');
    fs.writeFileSync(filePath, '// scope start\n// start\nold content\n// end\n// scope end');

    const plan: ApplyPlan = {
      operations: [
        {
          type: 'range',
          file: 'app/range.js',
          content: 'new content',
          directives: {
            START: '// start',
            END: '// end',
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
});
