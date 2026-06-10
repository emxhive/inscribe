import { describe, it, expect } from 'vitest';
import { computeDiffHunks } from '../../src/v2/diff';

describe('V2 Diff Hunks generator', () => {
  it('produces no hunks when content is identical', () => {
    const content = 'line 1\nline 2\n';
    const hunks = computeDiffHunks(content, content);
    expect(hunks.length).toBe(0);
  });

  it('produces precise replacement hunk for one meaningful changed line', () => {
    const oldContent = 'line 1\nline 2\nline 3\n';
    const newContent = 'line 1\nline 2 changed\nline 3\n';
    const hunks = computeDiffHunks(oldContent, newContent);

    expect(hunks.length).toBe(1);
    const hunk = hunks[0];
    expect(hunk.kind).toBe('replace');
    expect(hunk.oldText).toBe('line 2\n');
    expect(hunk.newText).toBe('line 2 changed\n');
    expect(hunk.oldStartLine).toBe(2);
    expect(hunk.oldEndLine).toBe(2);
    expect(hunk.newStartLine).toBe(2);
    expect(hunk.newEndLine).toBe(2);
  });

  it('produces precise insert hunk for new lines', () => {
    const oldContent = 'line 1\nline 2\n';
    const newContent = 'line 1\ninserted line\nline 2\n';
    const hunks = computeDiffHunks(oldContent, newContent);

    expect(hunks.length).toBe(1);
    const hunk = hunks[0];
    expect(hunk.kind).toBe('insert');
    expect(hunk.oldText).toBe('');
    expect(hunk.newText).toBe('inserted line\n');
    expect(hunk.oldStartLine).toBe(2);
    expect(hunk.newStartLine).toBe(2);
  });

  it('produces precise delete hunk for deleted lines', () => {
    const oldContent = 'line 1\nline 2\nline 3\n';
    const newContent = 'line 1\nline 3\n';
    const hunks = computeDiffHunks(oldContent, newContent);

    expect(hunks.length).toBe(1);
    const hunk = hunks[0];
    expect(hunk.kind).toBe('delete');
    expect(hunk.oldText).toBe('line 2\n');
    expect(hunk.newText).toBe('');
    expect(hunk.oldStartLine).toBe(2);
    expect(hunk.newStartLine).toBe(2);
  });
});
