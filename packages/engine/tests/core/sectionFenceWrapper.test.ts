import { describe, it, expect } from 'vitest';
import { parseSectionFenceWrapper, SectionLineInput } from '@inscribe/shared';

describe('parseSectionFenceWrapper', () => {
  it('unwraps standard backtick fences', () => {
    const lines: SectionLineInput[] = [
      { text: '```typescript', lineNum: 1 },
      { text: 'const x = 1;', lineNum: 2 },
      { text: '```', lineNum: 3 },
    ];
    const res = parseSectionFenceWrapper(lines);
    expect(res).toEqual({ type: 'unwrapped', bodyStartIdx: 1, bodyEndIdx: 1 });
  });

  it('unwraps tilde fences', () => {
    const lines: SectionLineInput[] = [
      { text: '~~~javascript', lineNum: 1 },
      { text: 'const x = 1;', lineNum: 2 },
      { text: '~~~', lineNum: 3 },
    ];
    const res = parseSectionFenceWrapper(lines);
    expect(res).toEqual({ type: 'unwrapped', bodyStartIdx: 1, bodyEndIdx: 1 });
  });

  it('supports variable length fence', () => {
    const lines: SectionLineInput[] = [
      { text: '````html', lineNum: 1 },
      { text: '<div></div>', lineNum: 2 },
      { text: '````', lineNum: 3 },
    ];
    const res = parseSectionFenceWrapper(lines);
    expect(res).toEqual({ type: 'unwrapped', bodyStartIdx: 1, bodyEndIdx: 1 });
  });

  it('supports variable length fence with longer closer', () => {
    const lines: SectionLineInput[] = [
      { text: '```html', lineNum: 1 },
      { text: '<div></div>', lineNum: 2 },
      { text: '`````', lineNum: 3 },
    ];
    const res = parseSectionFenceWrapper(lines);
    expect(res).toEqual({ type: 'unwrapped', bodyStartIdx: 1, bodyEndIdx: 1 });
  });

  it('allows 0-3 leading spaces', () => {
    const testSpace = (space: string) => {
      const lines: SectionLineInput[] = [
        { text: `${space}\`\`\`typescript`, lineNum: 1 },
        { text: 'const x = 1;', lineNum: 2 },
        { text: `${space}\`\`\``, lineNum: 3 },
      ];
      const res = parseSectionFenceWrapper(lines);
      expect(res.type).toBe('unwrapped');
    };
    testSpace('');
    testSpace(' ');
    testSpace('  ');
    testSpace('   ');
  });

  it('does not unwrap 4+ leading spaces', () => {
    const lines: SectionLineInput[] = [
      { text: '    ```typescript', lineNum: 1 },
      { text: 'const x = 1;', lineNum: 2 },
      { text: '    ```', lineNum: 3 },
    ];
    const res = parseSectionFenceWrapper(lines);
    expect(res.type).toBe('literal');
  });

  it('rejects missing closer in multi-line section', () => {
    const lines: SectionLineInput[] = [
      { text: '```typescript', lineNum: 1 },
      { text: 'const x = 1;', lineNum: 2 },
    ];
    const res = parseSectionFenceWrapper(lines);
    expect(res).toEqual({
      type: 'error',
      lineNum: 1,
      message: 'missing closing fence or trailing text after closer',
    });
  });

  it('rejects missing closer in single-line section', () => {
    const lines: SectionLineInput[] = [
      { text: '```typescript', lineNum: 1 },
    ];
    const res = parseSectionFenceWrapper(lines);
    expect(res).toEqual({
      type: 'error',
      lineNum: 1,
      message: 'missing closing fence',
    });
  });

  it('rejects wrong fence character', () => {
    const lines: SectionLineInput[] = [
      { text: '```typescript', lineNum: 1 },
      { text: 'const x = 1;', lineNum: 2 },
      { text: '~~~', lineNum: 3 },
    ];
    const res = parseSectionFenceWrapper(lines);
    expect(res).toEqual({
      type: 'error',
      lineNum: 1,
      message: 'closing fence uses the wrong character',
    });
  });

  it('rejects shorter closer', () => {
    const lines: SectionLineInput[] = [
      { text: '````typescript', lineNum: 1 },
      { text: 'const x = 1;', lineNum: 2 },
      { text: '```', lineNum: 3 },
    ];
    const res = parseSectionFenceWrapper(lines);
    expect(res).toEqual({
      type: 'error',
      lineNum: 1,
      message: 'closing fence is shorter than the opener',
    });
  });

  it('rejects trailing non-blank text after closer', () => {
    const lines: SectionLineInput[] = [
      { text: '```typescript', lineNum: 1 },
      { text: 'const x = 1;', lineNum: 2 },
      { text: '```', lineNum: 3 },
      { text: 'some prose here', lineNum: 4 },
    ];
    const res = parseSectionFenceWrapper(lines);
    expect(res).toEqual({
      type: 'error',
      lineNum: 1,
      message: 'missing closing fence or trailing text after closer',
    });
  });

  it('preserves internal/nested fences inside body', () => {
    const lines: SectionLineInput[] = [
      { text: '```markdown', lineNum: 1 },
      { text: '```javascript', lineNum: 2 },
      { text: 'const x = 1;', lineNum: 3 },
      { text: '```', lineNum: 4 },
      { text: '```', lineNum: 5 },
    ];
    const res = parseSectionFenceWrapper(lines);
    expect(res).toEqual({ type: 'unwrapped', bodyStartIdx: 1, bodyEndIdx: 3 });
  });
});
