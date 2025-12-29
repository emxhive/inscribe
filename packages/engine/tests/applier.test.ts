import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { applyChanges, undoLastApply } from '../src/applier';
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
});
