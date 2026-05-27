import { describe, expect, it } from 'vitest';
import { validateBlocks } from '../src/contract/validateBlocks';
import { resolveBetweenTarget, resolveRangeTarget } from '../src/target/textTargets';
import type { ParsedBlock } from '@inscribe/shared';

const sliceRange = (content: string, range: { replaceStart: number; replaceEnd: number }) =>
  content.slice(range.replaceStart, range.replaceEnd);

function blockWithEndOccurrence(value: string): ParsedBlock {
  return {
    file: 'src/example.ts',
    mode: 'replace_range',
    directives: {
      START_LINE_CONTAINS: '// start',
      END_LINE_CONTAINS: '// end',
      END_OCCURRENCE: value,
    },
    content: 'replacement',
    blockIndex: 0,
  };
}

describe('END_OCCURRENCE range resolution', () => {
  it('defaults to the first matching end after each start and lets RANGE_CONTAINS select the candidate', () => {
    const content = [
      '// start',
      'alpha',
      '// end',
      '// start',
      'beta',
      '// end',
    ].join('\n');

    const range = resolveRangeTarget(content, {
      START_LINE_CONTAINS: '// start',
      END_LINE_CONTAINS: '// end',
      RANGE_CONTAINS: 'beta',
    });

    expect(sliceRange(content, range)).toBe(['// start', 'beta', '// end'].join('\n'));
  });

  it('uses END_OCCURRENCE to select the nth matching end after each start', () => {
    const content = [
      '// start',
      'alpha',
      '// end',
      'beta',
      '// end',
    ].join('\n');

    const range = resolveRangeTarget(content, {
      START_LINE_CONTAINS: '// start',
      END_LINE_CONTAINS: '// end',
      END_OCCURRENCE: '2',
      RANGE_CONTAINS: 'beta',
    });

    expect(sliceRange(content, range)).toBe([
      '// start',
      'alpha',
      '// end',
      'beta',
      '// end',
    ].join('\n'));
  });

  it('does not try later end occurrences when RANGE_CONTAINS fails the selected occurrence', () => {
    const content = [
      '// start',
      'alpha',
      '// end',
      'beta',
      '// end',
    ].join('\n');

    expect(() =>
      resolveRangeTarget(content, {
        START_LINE_CONTAINS: '// start',
        END_LINE_CONTAINS: '// end',
        RANGE_CONTAINS: 'beta',
      }),
    ).toThrow('No range candidate matched boundary selectors and RANGE_CONTAINS filters');
  });

  it('fails when more than one start-based candidate survives filtering', () => {
    const content = [
      '// start',
      'shared',
      '// end',
      '// start',
      'shared',
      '// end',
    ].join('\n');

    expect(() =>
      resolveRangeTarget(content, {
        START_LINE_CONTAINS: '// start',
        END_LINE_CONTAINS: '// end',
        RANGE_CONTAINS: 'shared',
      }),
    ).toThrow('Range is ambiguous (2 matches)');
  });

  it('fails clearly when no start has the requested end occurrence', () => {
    const content = [
      '// start',
      'alpha',
      '// end',
      '// start',
      'beta',
      '// end',
    ].join('\n');

    expect(() =>
      resolveRangeTarget(content, {
        START_LINE_CONTAINS: '// start',
        END_LINE_CONTAINS: '// end',
        END_OCCURRENCE: '2',
      }),
    ).toThrow('No END boundary occurrence 2 found after START boundary matches');
  });

  it.each(['', '0', '-1', '1.5', 'two'])('rejects invalid END_OCCURRENCE value %j during validation', (value) => {
    const errors = validateBlocks([blockWithEndOccurrence(value)]);

    expect(errors.map((error) => error.message)).toContain('END_OCCURRENCE must be a positive integer');
  });
});

describe('END_OCCURRENCE between resolution', () => {
  it('preserves anchors and uses RANGE_CONTAINS to select one start-based candidate', () => {
    const content = [
      '// routes:start',
      'dashboard',
      '// routes:end',
      '// routes:start',
      'settings',
      '// routes:end',
    ].join('\n');

    const range = resolveBetweenTarget(content, {
      START_LINE_CONTAINS: '// routes:start',
      END_LINE_CONTAINS: '// routes:end',
      RANGE_CONTAINS: 'settings',
    });

    expect(sliceRange(content, range).trim()).toBe('settings');
  });

  it('uses END_OCCURRENCE for between targets without replacing the selected end anchor', () => {
    const content = [
      '// routes:start',
      'dashboard',
      '// routes:end',
      'settings',
      '// routes:end',
    ].join('\n');

    const range = resolveBetweenTarget(content, {
      START_LINE_CONTAINS: '// routes:start',
      END_LINE_CONTAINS: '// routes:end',
      END_OCCURRENCE: '2',
      RANGE_CONTAINS: 'settings',
    });

    expect(sliceRange(content, range).trim()).toBe(['dashboard', '// routes:end', 'settings'].join('\n'));
  });
});