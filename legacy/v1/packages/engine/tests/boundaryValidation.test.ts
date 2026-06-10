import { describe, it, expect } from 'vitest';
import { validateBlocks } from '../src/contract/validateBlocks';
import { ParsedBlock } from '@inscribe/shared';

describe('validateBlocks boundary rules', () => {
  it('allows START_LINE_CONTAINS', () => {
    const blocks: ParsedBlock[] = [{
      file: 'test.ts',
      mode: 'replace_line',
      directives: { START_LINE_CONTAINS: 'abc' },
      content: 'new',
      blockIndex: 0
    }];
    expect(validateBlocks(blocks)).toHaveLength(0);
  });

  it('allows START_LINE_EQUALS', () => {
    const blocks: ParsedBlock[] = [{
      file: 'test.ts',
      mode: 'replace_line',
      directives: { START_LINE_EQUALS: 'abc' },
      content: 'new',
      blockIndex: 0
    }];
    expect(validateBlocks(blocks)).toHaveLength(0);
  });

  it('rejects missing START for replace_line', () => {
    const blocks: ParsedBlock[] = [{
      file: 'test.ts',
      mode: 'replace_line',
      directives: {},
      content: 'new',
      blockIndex: 0
    }];
    const errors = validateBlocks(blocks);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('Missing required START boundary selector');
  });

  it('rejects using both CONTAINS and EQUALS for START', () => {
    const blocks: ParsedBlock[] = [{
      file: 'test.ts',
      mode: 'replace_line',
      directives: { START_LINE_CONTAINS: 'a', START_LINE_EQUALS: 'a' },
      content: 'new',
      blockIndex: 0
    }];
    const errors = validateBlocks(blocks);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('Cannot use both START_LINE_CONTAINS and START_LINE_EQUALS');
  });

  it('rejects old START directive', () => {
    const blocks: ParsedBlock[] = [{
      file: 'test.ts',
      mode: 'replace_line',
      directives: { START: 'abc' } as any,
      content: 'new',
      blockIndex: 0
    }];
    const errors = validateBlocks(blocks);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(e => e.message.includes('Invalid directive START'))).toBe(true);
  });

  it('validates replace_range with new directives', () => {
    const blocks: ParsedBlock[] = [{
      file: 'test.ts',
      mode: 'replace_range',
      directives: {
        START_LINE_CONTAINS: 'start',
        END_LINE_EQUALS: 'end',
        RANGE_CONTAINS: 'mid',
        RANGE_LINE_CONTAINS_ALL: 'id, status',
      },
      content: 'new',
      blockIndex: 0
    }];
    expect(validateBlocks(blocks)).toHaveLength(0);
  });

  it.each(['', 'id,', 'id,,status', 'id,   ,status'])('rejects invalid RANGE_LINE_CONTAINS_ALL value %j', (value) => {
    const blocks: ParsedBlock[] = [{
      file: 'test.ts',
      mode: 'replace_range',
      directives: {
        START_LINE_CONTAINS: 'start',
        END_LINE_EQUALS: 'end',
        RANGE_LINE_CONTAINS_ALL: value,
      },
      content: 'new',
      blockIndex: 0,
    }];

    const errors = validateBlocks(blocks);
    expect(errors.map((error) => error.message)).toContain(
      'RANGE_LINE_CONTAINS_ALL must be a comma-separated list of non-empty fragments'
    );
  });

  it('rejects RANGE_LINE_CONTAINS_ALL outside replace_range and replace_between', () => {
    const blocks: ParsedBlock[] = [{
      file: 'test.ts',
      mode: 'replace_line',
      directives: {
        START_LINE_CONTAINS: 'start',
        RANGE_LINE_CONTAINS_ALL: 'id, status',
      },
      content: 'new',
      blockIndex: 0,
    }];

    expect(validateBlocks(blocks).some((error) => error.message.includes('Invalid directive RANGE_LINE_CONTAINS_ALL'))).toBe(true);
  });

  it('allows RANGE_LINE_CONTAINS_ALL for replace_between', () => {
    const blocks: ParsedBlock[] = [{
      file: 'test.ts',
      mode: 'replace_between',
      directives: {
        START_LINE_CONTAINS: 'start',
        END_LINE_EQUALS: 'end',
        RANGE_LINE_CONTAINS_ALL: 'id, status',
      },
      content: 'new',
      blockIndex: 0,
    }];

    expect(validateBlocks(blocks)).toHaveLength(0);
  });

  it('rejects replace_range missing END', () => {
    const blocks: ParsedBlock[] = [{
      file: 'test.ts',
      mode: 'replace_range',
      directives: { START_LINE_CONTAINS: 'start' },
      content: 'new',
      blockIndex: 0
    }];
    const errors = validateBlocks(blocks);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('Missing required END boundary selector');
  });
});
