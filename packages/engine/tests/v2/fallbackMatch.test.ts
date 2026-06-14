import { describe, it, expect } from 'vitest';
import { performReplaceText } from '../../src/v2/text/exactMatch';
import { resolveOperation } from '../../src/v2/execution/resolveOperation';

describe('V2 replace_text fallback matching', () => {
  it('performReplaceText returns exact metadata on exact matches', () => {
    const content = 'const one = 1;\nconst two = 2;\nconst three = 3;';
    const search = 'const two = 2;';
    const replacement = 'const two = 20;';

    const result = performReplaceText(content, search, replacement);
    expect(result.afterContent).toBe('const one = 1;\nconst two = 20;\nconst three = 3;');
    expect(result.matchMetadata).toEqual({
      kind: 'exact',
      resolvedRange: { start: 15, end: 29 },
    });
  });

  it('performReplaceText returns fallback metadata and correct beforeRange/afterRange', () => {
    // Has 6 meaningful tokens (const, one, 1, const, two, 2)
    const content = 'const one = "1";\nconst two = "2";';
    const search = "const one = '1';\nconst two = '2';";
    const replacement = 'const one = 10;\nconst two = 20;';

    const result = performReplaceText(content, search, replacement);
    expect(result.afterContent).toBe('const one = 10;\nconst two = 20;');
    expect(result.matchMetadata.kind).toBe('fallback');
    expect(result.matchMetadata.score).toBeGreaterThanOrEqual(0.90);
    expect(result.matchMetadata.resolvedRange).toEqual({ start: 0, end: 33 });
    expect(result.beforeRange).toEqual({ start: 0, end: 33 });
    expect(result.afterRange).toEqual({ start: 0, end: 31 });
  });

  it('fallback rejects extra meaningful target tokens', () => {
    // Target has extra word "extra" and number "99"
    const content = 'const one = "1";\nconst extra = 99;\nconst two = "2";';
    const search = "const one = '1';\nconst two = '2';";
    const replacement = 'const one = 10;\nconst two = 20;';

    expect(() => performReplaceText(content, search, replacement)).toThrow('TARGET_NOT_FOUND');
  });

  it('fallback rejects operator drift, e.g. == vs =', () => {
    const content = 'const one == "1";\nconst two = "2";';
    const search = "const one = '1';\nconst two = '2';";
    const replacement = 'const one = 10;\nconst two = 20;';

    expect(() => performReplaceText(content, search, replacement)).toThrow('TARGET_NOT_FOUND');
  });

  it('fallback rejects operator drift, e.g. && vs ||', () => {
    const content = 'if (one && two) {\n  const three = 3;\n}';
    const search = 'if (one || two) {\n  const three = 3;\n}';
    const replacement = '/* replaced */';

    // Meaningful tokens: if, one, two, const, three, 3 (6 >= 5)
    expect(() => performReplaceText(content, search, replacement)).toThrow('TARGET_NOT_FOUND');
  });

  it('fallback allows quote drift and low-risk separator drift', () => {
    const content = 'const one = "1",\nconst two = "2";';
    const search = "const one = '1';\nconst two = '2';";
    const replacement = 'const one = 10;\nconst two = 20;';

    const result = performReplaceText(content, search, replacement);
    expect(result.matchMetadata.kind).toBe('fallback');
    expect(result.matchMetadata.score).toBeGreaterThanOrEqual(0.90);
  });

  it('fallback rejects multiple distinct candidate spans', () => {
    const content = 'const one = "1";\nconst two = "2";\n\nconst one = "1";\nconst two = "2";';
    const search = "const one = '1';\nconst two = '2';";
    const replacement = 'const one = 10;\nconst two = 20;';

    expect(() => performReplaceText(content, search, replacement)).toThrow('FALLBACK_TARGET_AMBIGUOUS');
  });

  it('resolveOperation stores metadata on targetScope', async () => {
    const content = 'const one = "1";\nconst two = "2";';
    const virtualState = new Map([
      ['test.ts', { content, exists: true }]
    ]);
    const payload = {
      strategy: 'replace_text' as const,
      filePath: 'test.ts',
      search: "const one = '1';\nconst two = '2';",
      content: 'const one = 10;\nconst two = 20;'
    };

    const execution = await resolveOperation(payload, virtualState);
    expect(execution.targetScope.matchMetadata).toBeDefined();
    expect(execution.targetScope.matchMetadata?.kind).toBe('fallback');
    expect(execution.targetScope.matchMetadata?.resolvedRange).toEqual({ start: 0, end: 33 });
  });

  it('fallback consumes adjacent trailing target quote drift without crossing required tokens', () => {
    const content = 'const one = "1";\nconst two = "2" const three = 3;';
    const search = "const one = '1';\nconst two = '2';";
    const replacement = 'const one = 10;\nconst two = 20;';

    const result = performReplaceText(content, search, replacement);
    expect(result.afterContent).toBe('const one = 10;\nconst two = 20; const three = 3;');
    expect(result.afterContent).not.toContain('20;" const three');
    expect(result.matchMetadata.resolvedRange).toEqual({ start: 0, end: 32 });
  });

  it('fallback does not leave stale quote before following code', () => {
    const content = 'const one = "1";\nconst two = "2" const three = 3;';
    const search = "const one = '1';\nconst two = '2';";
    const replacement = 'const one = 10;\nconst two = 20;';

    const result = performReplaceText(content, search, replacement);
    expect(result.afterContent).toBe('const one = 10;\nconst two = 20; const three = 3;');
    expect(result.afterContent).not.toContain('20;" const three');
  });

  it('fallback consumes comma-vs-semicolon boundary drift without leaving stale punctuation', () => {
    const content = 'const one = "1";\nconst two = "2",';
    const search = "const one = '1';\nconst two = '2';";
    const replacement = 'const one = 10;\nconst two = 20;';

    const result = performReplaceText(content, search, replacement);
    expect(result.afterContent).toBe('const one = 10;\nconst two = 20;');
    expect(result.afterContent).not.toContain('20;,');
    expect(result.matchMetadata.resolvedRange).toEqual({ start: 0, end: 33 });
  });

  it('fallback does not expand leading soft token across required target tokens', () => {
    const content = 'const zero = 0 const one = "1";\nconst two = "2";';
    const search = "; const one = '1';\nconst two = '2';";
    const replacement = 'const one = 10;\nconst two = 20;';

    const result = performReplaceText(content, search, replacement);
    expect(result.afterContent).toBe('const zero = 0 const one = 10;\nconst two = 20;');
    expect(result.matchMetadata.resolvedRange).toEqual({ start: 15, end: 48 });
  });

  it('fallback is disabled when SEARCH has fewer than 5 meaningful tokens', () => {
    const content = 'const one = "1";';
    const search = "const one = '1';";
    const replacement = 'const one = 10;';

    expect(() => performReplaceText(content, search, replacement)).toThrow('TARGET_NOT_FOUND');
  });
});
