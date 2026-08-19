import { describe, it, expect } from 'vitest';
import { resolvePlan } from '../../src/v2/execution/resolvePlan';

describe('V2 virtual sequential execution plan', () => {
  it('runs multiple sequential operations against one virtual file', async () => {
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
        search: 'line 2'
      },
      {
        strategy: 'replace_file' as const,
        filePath: 'test.ts',
        content: 'final file content'
      }
    ];

    const plan = await resolvePlan(payloads, initialFiles);

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

  it('continues diagnosing after an error without promoting later same-file work', async () => {
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
        search: 'non_existent_string'
      },
      {
        strategy: 'replace_file' as const,
        filePath: 'test.ts',
        content: 'third'
      }
    ];

    const plan = await resolvePlan(payloads, initialFiles);

    expect(plan.errors.length).toBe(1);
    expect(plan.errors[0].stepIndex).toBe(1);
    expect(plan.errors[0].message).toContain('TARGET_NOT_FOUND');
    expect(plan.executions.length).toBe(1);
    expect(plan.executionStepIndices).toEqual([0]);
    expect(plan.executions[0].afterContent).toBe('first');
    expect(plan.exclusions).toEqual([
      expect.objectContaining({
        stepIndex: 2,
        filePath: 'test.ts',
        blockedByStepIndex: 1,
      }),
    ]);
  });

  it('succeeds in create_file -> replace_text -> delete_file sequence', async () => {
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
        search: 'line 2'
      },
      {
        strategy: 'delete_file' as const,
        filePath: 'test.ts'
      }
    ];

    const plan = await resolvePlan(payloads, initialFiles);
    expect(plan.errors.length).toBe(0);
    expect(plan.executions.length).toBe(3);
    expect(plan.executions[0].afterExists).toBe(true);
    expect(plan.executions[1].afterContent).toBe('line 1\nline 2 changed');
    expect(plan.executions[2].afterExists).toBe(false);
  });

  it('fails in delete_file -> replace_text sequence', async () => {
    const initialFiles = new Map([
      ['test.ts', { content: 'line 1\nline 2', exists: true }]
    ]);
    const payloads = [
      {
        strategy: 'delete_file' as const,
        filePath: 'test.ts'
      },
      {
        strategy: 'replace_text' as const,
        filePath: 'test.ts',
        content: 'change',
        search: 'line 1'
      }
    ];

    const plan = await resolvePlan(payloads, initialFiles);
    expect(plan.errors.length).toBe(1);
    expect(plan.errors[0].stepIndex).toBe(1);
    expect(plan.errors[0].message).toContain('File does not exist');
    expect(plan.executions.length).toBe(1);
  });

  it('succeeds in delete_file -> create_file same path sequence', async () => {
    const initialFiles = new Map([
      ['test.ts', { content: 'line 1\nline 2', exists: true }]
    ]);
    const payloads = [
      {
        strategy: 'delete_file' as const,
        filePath: 'test.ts'
      },
      {
        strategy: 'create_file' as const,
        filePath: 'test.ts',
        content: 'brand new file'
      }
    ];

    const plan = await resolvePlan(payloads, initialFiles);
    expect(plan.errors.length).toBe(0);
    expect(plan.executions.length).toBe(2);
    expect(plan.executions[0].afterExists).toBe(false);
    expect(plan.executions[1].beforeExists).toBe(false);
    expect(plan.executions[1].afterExists).toBe(true);
    expect(plan.executions[1].afterContent).toBe('brand new file');
  });

  it('fails in create_file -> create_file same path sequence', async () => {
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

    const plan = await resolvePlan(payloads, initialFiles);
    expect(plan.errors.length).toBe(1);
    expect(plan.errors[0].stepIndex).toBe(1);
    expect(plan.errors[0].message).toContain('File already exists');
    expect(plan.executions.length).toBe(1);
  });

  it('does not suppress an unaffected file after a resolution failure', async () => {
    const initialFiles = new Map();
    const payloads = [
      {
        strategy: 'create_file' as const,
        filePath: 'a.ts',
        content: 'first',
      },
      {
        strategy: 'replace_text' as const,
        filePath: 'a.ts',
        content: 'failed',
        search: 'missing',
      },
      {
        strategy: 'replace_file' as const,
        filePath: 'a.ts',
        content: 'excluded',
      },
      {
        strategy: 'create_file' as const,
        filePath: 'b.ts',
        content: 'independent',
      },
    ];

    const plan = await resolvePlan(payloads, initialFiles);

    expect(plan.errors).toEqual([
      expect.objectContaining({ stepIndex: 1, filePath: 'a.ts' }),
    ]);
    expect(plan.exclusions).toEqual([
      expect.objectContaining({ stepIndex: 2, blockedByStepIndex: 1 }),
    ]);
    expect(plan.executionStepIndices).toEqual([0, 3]);
    expect(plan.executions.map((execution) => execution.filePath)).toEqual(['a.ts', 'b.ts']);
  });

  it('keeps multiple downstream same-file operations diagnosable but excluded', async () => {
    const initialFiles = new Map([
      ['a.ts', { content: 'original', exists: true }],
    ]);
    const payloads = [
      {
        strategy: 'replace_text' as const,
        filePath: 'a.ts',
        content: 'failed',
        search: 'missing',
      },
      {
        strategy: 'replace_file' as const,
        filePath: 'a.ts',
        content: 'second',
      },
      {
        strategy: 'delete_file' as const,
        filePath: 'a.ts',
      },
    ];

    const plan = await resolvePlan(payloads, initialFiles);

    expect(plan.errors).toHaveLength(1);
    expect(plan.exclusions.map((exclusion) => exclusion.stepIndex)).toEqual([1, 2]);
    expect(plan.exclusions.every((exclusion) => exclusion.blockedByStepIndex === 0)).toBe(true);
    expect(plan.executions).toHaveLength(0);
  });

  it('never includes an execution whose same-file predecessor failed', async () => {
    const initialFiles = new Map([
      ['a.ts', { content: 'original', exists: true }],
    ]);
    const payloads = [
      {
        strategy: 'replace_text' as const,
        filePath: 'a.ts',
        content: 'failed',
        search: 'missing',
      },
      {
        strategy: 'replace_file' as const,
        filePath: 'a.ts',
        content: 'would use stale state',
      },
      {
        strategy: 'create_file' as const,
        filePath: 'b.ts',
        content: 'safe',
      },
    ];

    const plan = await resolvePlan(payloads, initialFiles);

    expect(plan.executionStepIndices).toEqual([2]);
    expect(plan.executions[0].filePath).toBe('b.ts');
    expect(plan.exclusions.map((exclusion) => exclusion.stepIndex)).toEqual([1]);
  });
});
