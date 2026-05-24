import { describe, expect, it } from 'vitest';
import { diffLinesStable } from '../src/preview/lineDiff';

describe('diffLinesStable', () => {
  it('returns stable line diff parts for separated changes', () => {
    const oldText = 'a\nold1\nkeep\nold2\n';
    const newText = 'a\nnew1\nkeep\nnew2\n';
    const parts = diffLinesStable(oldText, newText);
    expect(parts.some((p) => p.removed && p.value.includes('old1'))).toBe(true);
    expect(parts.some((p) => p.added && p.value.includes('new1'))).toBe(true);
    expect(parts.some((p) => p.removed && p.value.includes('old2'))).toBe(true);
    expect(parts.some((p) => p.added && p.value.includes('new2'))).toBe(true);
  });
});
