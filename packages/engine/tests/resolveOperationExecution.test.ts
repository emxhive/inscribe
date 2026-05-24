import { describe, expect, it } from 'vitest';
import { resolveOperationExecution } from '../src/operation/resolveOperationExecution';

describe('resolveOperationExecution', () => {
  it('handles file modes and partial replacement', () => {
    expect(resolveOperationExecution({ type:'create_file', file:'a', content:'x' }, { exists:false, content:'' }).afterContent).toBe('x');
    expect(resolveOperationExecution({ type:'replace_file', file:'a', content:'y' }, { exists:true, content:'x' }).afterContent).toBe('y');
    expect(resolveOperationExecution({ type:'append_file', file:'a', content:'y' }, { exists:true, content:'x' }).afterContent).toBe('xy');
    expect(resolveOperationExecution({ type:'delete_file', file:'a', content:'' }, { exists:true, content:'x' }).afterExists).toBe(false);

    const line = resolveOperationExecution({ type:'replace_line', file:'a', content:'zz', directives:{ START:'hello'} }, { exists:true, content:'hello\nworld\n' });
    expect(line.kind).toBe('partial_replacement');
    if (line.kind === 'partial_replacement') expect(line.replacement.oldText).toBe('hello\n');
  });

  it('rejects old modes', () => {
    expect(() => resolveOperationExecution({ type:'create' as any, file:'a', content:'' }, { exists:false, content:'' })).toThrow();
  });

  it('replace_between same-line anchor behavior', () => {
    const ok = resolveOperationExecution({ type:'replace_between', file:'a', content:'M', directives:{ START:'(', END:')' } }, { exists:true, content:'a(b)c\n' });
    expect(ok.afterContent).toBe('a(M)c\n');
    expect(() => resolveOperationExecution({ type:'replace_between', file:'a', content:'M', directives:{ START:'()', END:')' } }, { exists:true, content:'a()c\n' })).toThrow();
  });
});
