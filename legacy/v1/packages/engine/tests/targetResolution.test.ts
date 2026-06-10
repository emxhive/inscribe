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
      const content = [
        '// block:start',
        'alpha',
        '// block:end',
        '// block:start',
        'beta',
        'target',
        '// block:end',
      ].join('\n');

      const range = resolveRangeTarget(content, {
        START_LINE_CONTAINS: '// block:start',
        END_LINE_CONTAINS: '// block:end',
        RANGE_CONTAINS: 'target',
      });

      expect(content.slice(range.replaceStart, range.replaceEnd)).toBe([
        '// block:start',
        'beta',
        'target',
        '// block:end',
      ].join('\n'));
    });
    it('applies multiple RANGE_CONTAINS filters as AND conditions', () => {
      const content = [
        '// block:start',
        'alpha',
        'shared',
        '// block:end',
        '// block:start',
        'target',
        'shared',
        '// block:end',
        '// block:start',
        'target',
        'other',
        '// block:end',
      ].join('\n');

      const range = resolveRangeTarget(content, {
        START_LINE_CONTAINS: '// block:start',
        END_LINE_CONTAINS: '// block:end',
        RANGE_CONTAINS: 'target\nshared',
      });

      expect(content.slice(range.replaceStart, range.replaceEnd)).toBe([
        '// block:start',
        'target',
        'shared',
        '// block:end',
      ].join('\n') + '\n');
    });

    it('uses RANGE_LINE_CONTAINS_ALL when all fragments appear on the same line', () => {
      const content = [
        '// block:start',
        'alpha id=one status=old',
        '// block:end',
        '// block:start',
        'beta id=two status=new',
        '// block:end',
      ].join('\n');

      const range = resolveRangeTarget(content, {
        START_LINE_CONTAINS: '// block:start',
        END_LINE_CONTAINS: '// block:end',
        RANGE_LINE_CONTAINS_ALL: 'id=two, status=new',
      });

      expect(content.slice(range.replaceStart, range.replaceEnd)).toBe([
        '// block:start',
        'beta id=two status=new',
        '// block:end',
      ].join('\n'));
    });

    it('does not match RANGE_LINE_CONTAINS_ALL fragments spread across different lines', () => {
      const content = [
        '// block:start',
        'id=two',
        'status=new',
        '// block:end',
      ].join('\n');

      expect(() => resolveRangeTarget(content, {
        START_LINE_CONTAINS: '// block:start',
        END_LINE_CONTAINS: '// block:end',
        RANGE_LINE_CONTAINS_ALL: 'id=two, status=new',
      })).toThrow('No range candidate matched boundary selectors and RANGE_CONTAINS filters');
    });

    it('applies multiple RANGE_LINE_CONTAINS_ALL directives as AND conditions', () => {
      const content = [
        '// block:start',
        'id=one status=new',
        'role=admin enabled=false',
        '// block:end',
        '// block:start',
        'id=two status=new',
        'role=admin enabled=true',
        '// block:end',
      ].join('\n');

      const range = resolveRangeTarget(content, {
        START_LINE_CONTAINS: '// block:start',
        END_LINE_CONTAINS: '// block:end',
        RANGE_LINE_CONTAINS_ALL: 'id=two, status=new\nrole=admin, enabled=true',
      });

      expect(content.slice(range.replaceStart, range.replaceEnd)).toBe([
        '// block:start',
        'id=two status=new',
        'role=admin enabled=true',
        '// block:end',
      ].join('\n'));
    });

    it('keeps RANGE_CONTAINS as an exact substring anywhere in the candidate', () => {
      const content = [
        '// block:start',
        'first fragment',
        'second fragment',
        '// block:end',
      ].join('\n');

      const range = resolveRangeTarget(content, {
        START_LINE_CONTAINS: '// block:start',
        END_LINE_CONTAINS: '// block:end',
        RANGE_CONTAINS: 'first fragment\nsecond fragment',
      });

      expect(content.slice(range.replaceStart, range.replaceEnd)).toBe(content);
    });

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
    it('rejects missing START selector strategies', () => {
      expect(() => resolveBlockTarget('if (ok) { run(); }\n', {}))
        .toThrow('Missing required START boundary selector (START_LINE_CONTAINS or START_LINE_EQUALS)');
    });

    it('rejects both START selector strategies', () => {
      expect(() => resolveBlockTarget('if (ok) { run(); }\n', {
        START_LINE_CONTAINS: 'if (ok)',
        START_LINE_EQUALS: 'if (ok) { run(); }',
      })).toThrow('Cannot use both START_LINE_CONTAINS and START_LINE_EQUALS');
    });
  });
});
