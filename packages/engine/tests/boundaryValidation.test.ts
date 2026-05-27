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
        RANGE_CONTAINS: 'mid'
      },
      content: 'new',
      blockIndex: 0
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
