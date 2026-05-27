import { describe, it, expect } from 'vitest';
import { resolveLineTarget, resolveRangeTarget, resolveBetweenTarget } from '../src/target/textTargets';
import { resolveBlockTarget } from '../src/target/blockTarget';
import { resolveOperationExecution } from '../src/operation/resolveOperationExecution';

describe('textTargets resolution', () => {
  const content = `line 1
  line 2
line 3
line 2
line 4`;

  describe('resolveLineTarget', () => {
    it('resolves unique START_LINE_EQUALS', () => {
      const res = resolveLineTarget(content, { START_LINE_EQUALS: 'line 1' });
      expect(res.replaceStart).toBe(0);
      expect(res.replaceEnd).toBe(7);
    });

    it('matches START_LINE_EQUALS against the trimmed full line only', () => {
      const equalsContent = '  alpha   beta  \nalpha beta\n';
      const res = resolveLineTarget(equalsContent, { START_LINE_EQUALS: 'alpha   beta' });
      expect(equalsContent.slice(res.replaceStart, res.replaceEnd)).toBe('  alpha   beta  \n');

      const internalWhitespaceRes = resolveLineTarget(equalsContent, { START_LINE_EQUALS: 'alpha beta' });
      expect(equalsContent.slice(internalWhitespaceRes.replaceStart, internalWhitespaceRes.replaceEnd)).toBe('alpha beta\n');
    });

    it('fails ambiguous START_LINE_EQUALS', () => {
      expect(() => resolveLineTarget(content, { START_LINE_EQUALS: 'line 2' }))
        .toThrow('START_LINE_EQUALS anchor is ambiguous (2 matches)');
    });

    it('resolves unique START_LINE_CONTAINS', () => {
      const res = resolveLineTarget(content, { START_LINE_CONTAINS: 'line 3' });
      expect(content.slice(res.replaceStart, res.replaceEnd)).toBe('line 3\n');
    });

    it('judges ambiguity at line level for START_LINE_CONTAINS', () => {
      const multiContent = "abc abc\ndef";
      // Two "abc" on one line should be fine.
      const res = resolveLineTarget(multiContent, { START_LINE_CONTAINS: 'abc' });
      expect(res.replaceStart).toBe(0);
      expect(res.replaceEnd).toBe(8);
    });

    it('keeps START_LINE_CONTAINS confined to individual lines', () => {
      expect(() => resolveLineTarget('alpha\nbeta\n', { START_LINE_CONTAINS: 'alpha\nbeta' }))
        .toThrow('START_LINE_CONTAINS anchor not found');
    });

    it('treats multiple matching lines as ambiguous', () => {
      expect(() => resolveLineTarget('alpha\nalpha\n', { START_LINE_CONTAINS: 'alpha' }))
        .toThrow('START_LINE_CONTAINS anchor is ambiguous (2 matches)');
    });
  });

  describe('resolveRangeTarget', () => {
    it('resolves range from START_LINE_CONTAINS to END_LINE_EQUALS', () => {
      const res = resolveRangeTarget(content, {
        START_LINE_CONTAINS: 'line 1',
        END_LINE_EQUALS: 'line 3'
      });
      expect(res.replaceStart).toBe(0);
      expect(content.slice(res.replaceStart, res.replaceEnd)).toBe('line 1\n  line 2\nline 3\n');
    });

    it('uses RANGE_CONTAINS to disambiguate', () => {
      const res = resolveRangeTarget(content, {
        START_LINE_EQUALS: 'line 1',
        END_LINE_EQUALS: 'line 2',
        RANGE_CONTAINS: 'line 3' // This should select the range ending at the second "line 2"
      });
      expect(res.replaceStart).toBe(0);
      expect(content.slice(res.replaceStart, res.replaceEnd)).toBe('line 1\n  line 2\nline 3\nline 2\n');
    });

    it('applies multiple RANGE_CONTAINS filters as AND conditions', () => {
      const rangeContent = `start
one
end
two
end`;
      const res = resolveRangeTarget(rangeContent, {
        START_LINE_EQUALS: 'start',
        END_LINE_EQUALS: 'end',
        RANGE_CONTAINS: 'one\ntwo',
      });
      expect(rangeContent.slice(res.replaceStart, res.replaceEnd)).toBe('start\none\nend\ntwo\nend');
    });
  });

  describe('resolveBetweenTarget', () => {
    it('resolves between anchors', () => {
      const res = resolveBetweenTarget(content, {
        START_LINE_CONTAINS: 'line 1',
        END_LINE_CONTAINS: 'line 3'
      });
      expect(res.replaceStart).toBe(7); // After "line 1\n"
      expect(res.replaceEnd).toBe(16); // Before "line 3\n"
    });

    it('allows same-line between only with CONTAINS', () => {
      const sameLine = "prefix START middle END suffix\n";
      const res = resolveBetweenTarget(sameLine, {
        START_LINE_CONTAINS: 'START',
        END_LINE_CONTAINS: 'END'
      });
      expect(res.replaceStart).toBe(12);
      expect(res.replaceEnd).toBe(20);
    });

    it('preserves exact same-line interior whitespace when replacing between contains anchors', () => {
      const sameLine = 'prefix START  \t middle  END suffix\n';
      const result = resolveOperationExecution({
        type: 'replace_between',
        file: 'test.txt',
        content: 'NEW',
        directives: {
          START_LINE_CONTAINS: 'START',
          END_LINE_CONTAINS: 'END',
        },
      }, { exists: true, content: sameLine });

      expect(result.afterContent).toBe('prefix STARTNEWEND suffix\n');
      if (result.kind !== 'partial_replacement') throw new Error('Expected partial replacement');
      expect(result.replacement.oldText).toBe('  \t middle  ');
    });

    it('rejects same-line between with EQUALS', () => {
      const sameLine = "START middle END";
      expect(() => resolveBetweenTarget(sameLine, {
        START_LINE_EQUALS: 'START middle END',
        END_LINE_EQUALS: 'START middle END'
      })).toThrow('No range candidate matched boundary selectors and RANGE_CONTAINS filters');
    });

    it('rejects ambiguous repeated same-line contains spans', () => {
      const sameLine = 'START a END b START c END\n';
      expect(() => resolveBetweenTarget(sameLine, {
        START_LINE_CONTAINS: 'START',
        END_LINE_CONTAINS: 'END',
      })).toThrow('Range is ambiguous');
    });
  });

  describe('resolveBlockTarget', () => {
    it('rejects both START selector strategies', () => {
      expect(() => resolveBlockTarget('if (ok) { run(); }\n', {
        START_LINE_CONTAINS: 'if (ok)',
        START_LINE_EQUALS: 'if (ok) { run(); }',
      })).toThrow('Cannot use both START_LINE_CONTAINS and START_LINE_EQUALS');
    });
  });
});
