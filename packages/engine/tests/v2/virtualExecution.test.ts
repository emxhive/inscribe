import { describe, it, expect } from 'vitest';
import { resolvePlan } from '../../src/v2/execution/resolvePlan';

describe('V2 virtual sequential execution plan', () => {
  it('runs multiple sequential operations against one virtual file', () => {
    const initialFiles = new Map();
    const payloads = [
      {
        strategy: 'create_file' as const,
        filePath: 'test.ts',
        content: 'line 1\nline 2'
      },
      {
        strategy: 'replace_text' as const,
        filePath: 'test.ts',
        content: 'line 2 changed',
        directives: { SEARCH: 'line 2' }
      },
      {
        strategy: 'replace_file' as const,
        filePath: 'test.ts',
        content: 'final file content'
      }
    ];

    const plan = resolvePlan(payloads, initialFiles);

    expect(plan.errors.length).toBe(0);
    expect(plan.executions.length).toBe(3);

    // Step 1: Create
    expect(plan.executions[0].beforeExists).toBe(false);
    expect(plan.executions[0].afterExists).toBe(true);
    expect(plan.executions[0].afterContent).toBe('line 1\nline 2');

    // Step 2: Replace text
    expect(plan.executions[1].beforeExists).toBe(true);
    expect(plan.executions[1].afterExists).toBe(true);
    expect(plan.executions[1].beforeContent).toBe('line 1\nline 2');
    expect(plan.executions[1].afterContent).toBe('line 1\nline 2 changed');

    // Step 3: Replace file
    expect(plan.executions[2].beforeExists).toBe(true);
    expect(plan.executions[2].afterExists).toBe(true);
    expect(plan.executions[2].beforeContent).toBe('line 1\nline 2 changed');
    expect(plan.executions[2].afterContent).toBe('final file content');
  });

  it('halts execution on the first error in the sequence', () => {
    const initialFiles = new Map();
    const payloads = [
      {
        strategy: 'create_file' as const,
        filePath: 'test.ts',
        content: 'first'
      },
      {
        // Should fail because target does not exist
        strategy: 'replace_text' as const,
        filePath: 'test.ts',
        content: 'fail',
        directives: { SEARCH: 'non_existent_string' }
      },
      {
        strategy: 'replace_file' as const,
        filePath: 'test.ts',
        content: 'third'
      }
    ];

    const plan = resolvePlan(payloads, initialFiles);

    expect(plan.errors.length).toBe(1);
    expect(plan.errors[0].stepIndex).toBe(1);
    expect(plan.errors[0].message).toContain('TARGET_NOT_FOUND');
    expect(plan.executions.length).toBe(1);
    expect(plan.executions[0].afterContent).toBe('first');
  });

  it('succeeds in create_file -> replace_text -> delete_file sequence', () => {
    const initialFiles = new Map();
    const payloads = [
      {
        strategy: 'create_file' as const,
        filePath: 'test.ts',
        content: 'line 1\nline 2'
      },
      {
        strategy: 'replace_text' as const,
        filePath: 'test.ts',
        content: 'line 2 changed',
        directives: { SEARCH: 'line 2' }
      },
      {
        strategy: 'delete_file' as const,
        filePath: 'test.ts',
        content: ''
      }
    ];

    const plan = resolvePlan(payloads, initialFiles);
    expect(plan.errors.length).toBe(0);
    expect(plan.executions.length).toBe(3);
    expect(plan.executions[0].afterExists).toBe(true);
    expect(plan.executions[1].afterContent).toBe('line 1\nline 2 changed');
    expect(plan.executions[2].afterExists).toBe(false);
  });

  it('fails in delete_file -> replace_text sequence', () => {
    const initialFiles = new Map([
      ['test.ts', { content: 'line 1\nline 2', exists: true }]
    ]);
    const payloads = [
      {
        strategy: 'delete_file' as const,
        filePath: 'test.ts',
        content: ''
      },
      {
        strategy: 'replace_text' as const,
        filePath: 'test.ts',
        content: 'change',
        directives: { SEARCH: 'line 1' }
      }
    ];

    const plan = resolvePlan(payloads, initialFiles);
    expect(plan.errors.length).toBe(1);
    expect(plan.errors[0].stepIndex).toBe(1);
    expect(plan.errors[0].message).toContain('File does not exist');
    expect(plan.executions.length).toBe(1);
  });

  it('succeeds in delete_file -> create_file same path sequence', () => {
    const initialFiles = new Map([
      ['test.ts', { content: 'line 1\nline 2', exists: true }]
    ]);
    const payloads = [
      {
        strategy: 'delete_file' as const,
        filePath: 'test.ts',
        content: ''
      },
      {
        strategy: 'create_file' as const,
        filePath: 'test.ts',
        content: 'brand new file'
      }
    ];

    const plan = resolvePlan(payloads, initialFiles);
    expect(plan.errors.length).toBe(0);
    expect(plan.executions.length).toBe(2);
    expect(plan.executions[0].afterExists).toBe(false);
    expect(plan.executions[1].beforeExists).toBe(false);
    expect(plan.executions[1].afterExists).toBe(true);
    expect(plan.executions[1].afterContent).toBe('brand new file');
  });

  it('fails in create_file -> create_file same path sequence', () => {
    const initialFiles = new Map();
    const payloads = [
      {
        strategy: 'create_file' as const,
        filePath: 'test.ts',
        content: 'first'
      },
      {
        strategy: 'create_file' as const,
        filePath: 'test.ts',
        content: 'second'
      }
    ];

    const plan = resolvePlan(payloads, initialFiles);
    expect(plan.errors.length).toBe(1);
    expect(plan.errors[0].stepIndex).toBe(1);
    expect(plan.errors[0].message).toContain('File already exists');
    expect(plan.executions.length).toBe(1);
  });
});
