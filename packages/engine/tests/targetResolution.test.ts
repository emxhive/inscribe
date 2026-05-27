import { describe, it, expect } from 'vitest';
import { resolveLineTarget, resolveRangeTarget, resolveBetweenTarget } from '../src/target/textTargets';

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

    it('fails ambiguous START_LINE_EQUALS', () => {
      expect(() => resolveLineTarget(content, { START_LINE_EQUALS: 'line 2' }))
        .toThrow('START_LINE_EQUALS anchor is ambiguous (2 matches)');
    });

    it('resolves unique START_LINE_CONTAINS', () => {
      const res = resolveLineTarget(content, { START_LINE_CONTAINS: 'line 3' });
      expect(res.replaceStart).toBe(17);
      expect(res.replaceEnd).toBe(24);
    });

    it('judges ambiguity at line level for START_LINE_CONTAINS', () => {
      const multiContent = "abc abc\ndef";
      // Two "abc" on one line should be fine.
      const res = resolveLineTarget(multiContent, { START_LINE_CONTAINS: 'abc' });
      expect(res.replaceStart).toBe(0);
      expect(res.replaceEnd).toBe(8);
    });
  });

  describe('resolveRangeTarget', () => {
    it('resolves range from START_LINE_CONTAINS to END_LINE_EQUALS', () => {
      const res = resolveRangeTarget(content, {
        START_LINE_CONTAINS: 'line 1',
        END_LINE_EQUALS: 'line 3'
      });
      expect(res.replaceStart).toBe(0);
      expect(res.replaceEnd).toBe(24);
    });

    it('uses RANGE_CONTAINS to disambiguate', () => {
      const res = resolveRangeTarget(content, {
        START_LINE_EQUALS: 'line 1',
        END_LINE_EQUALS: 'line 2',
        RANGE_CONTAINS: 'line 3' // This should select the range ending at the second "line 2"
      });
      expect(res.replaceStart).toBe(0);
      expect(res.replaceEnd).toBe(31);
    });
  });

  describe('resolveBetweenTarget', () => {
    it('resolves between anchors', () => {
      const res = resolveBetweenTarget(content, {
        START_LINE_CONTAINS: 'line 1',
        END_LINE_CONTAINS: 'line 3'
      });
      expect(res.replaceStart).toBe(7); // After "line 1\n"
      expect(res.replaceEnd).toBe(17); // Before "line 3\n"
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

    it('rejects same-line between with EQUALS', () => {
      const sameLine = "START middle END";
      expect(() => resolveBetweenTarget(sameLine, {
        START_LINE_EQUALS: 'START middle END',
        END_LINE_EQUALS: 'START middle END'
      })).toThrow('No range candidate matched START + END + CONTAINS');
    });
  });
});
