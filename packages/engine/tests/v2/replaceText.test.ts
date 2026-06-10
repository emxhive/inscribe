import { describe, it, expect } from 'vitest';
import { performReplaceText } from '../../src/v2/text/exactMatch';

describe('V2 replace_text strategy matching', () => {
  it('succeeds when exactly one match exists', () => {
    const fileContent = 'const a = 1;\nconst b = 2;\nconst c = 3;';
    const search = 'const b = 2;';
    const replacement = 'const b = 20;';
    const result = performReplaceText(fileContent, search, replacement);
    
    expect(result.afterContent).toBe('const a = 1;\nconst b = 20;\nconst c = 3;');
    expect(result.beforeRange).toEqual({ start: 13, end: 25 });
    expect(result.afterRange).toEqual({ start: 13, end: 26 });
  });

  it('fails with TARGET_NOT_FOUND when zero matches exist', () => {
    const fileContent = 'const a = 1;\nconst b = 2;\nconst c = 3;';
    const search = 'const d = 4;';
    const replacement = 'const d = 40;';
    expect(() => performReplaceText(fileContent, search, replacement)).toThrow(
      'TARGET_NOT_FOUND'
    );
  });

  it('fails with MUTABLE_TARGET_AMBIGUOUS when multiple matches exist', () => {
    const fileContent = 'const a = 1;\nconst b = 2;\nconst b = 2;\nconst c = 3;';
    const search = 'const b = 2;';
    const replacement = 'const b = 20;';
    expect(() => performReplaceText(fileContent, search, replacement)).toThrow(
      'MUTABLE_TARGET_AMBIGUOUS'
    );
  });

  it('fails with INVALID_SEARCH when search is empty', () => {
    const fileContent = 'const a = 1;';
    const search = '';
    const replacement = 'const a = 10;';
    expect(() => performReplaceText(fileContent, search, replacement)).toThrow(
      'INVALID_SEARCH: SEARCH must not be empty.'
    );
  });

  it('supports multiline exact matching', () => {
    const fileContent = 'class Test {\n  run() {\n    return 1;\n  }\n}';
    const search = '  run() {\n    return 1;\n  }';
    const replacement = '  run() {\n    return 2;\n  }';
    const result = performReplaceText(fileContent, search, replacement);
    expect(result.afterContent).toBe('class Test {\n  run() {\n    return 2;\n  }\n}');
    expect(result.beforeRange).toEqual({ start: 13, end: 40 });
    expect(result.afterRange).toEqual({ start: 13, end: 40 });
  });
});
