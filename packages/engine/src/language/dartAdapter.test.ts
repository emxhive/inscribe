import { describe, it, expect } from 'vitest';
import { dartAdapter } from './dartAdapter';

describe('dartAdapter', () => {
  it('supports .dart files', () => {
    expect(dartAdapter.supportsFile('test.dart')).toBe(true);
    expect(dartAdapter.supportsFile('test.js')).toBe(false);
  });

  it('resolves top-level function', () => {
    const content = 'void hello() { print("world"); }';
    const range = dartAdapter.resolveSymbolDeclarationRange(content, 'hello');
    expect(range.start).toBe(0);
    expect(range.end).toBe(32);
  });

  it('resolves class', () => {
    const content = 'class MyClass {}';
    const range = dartAdapter.resolveSymbolDeclarationRange(content, 'MyClass');
    expect(range.start).toBe(0);
    expect(range.end).toBe(16);
  });

  it('resolves method inside class', () => {
    const content = 'class MyClass {\n  void myMethod() {}\n}';
    const range = dartAdapter.resolveSymbolDeclarationRange(content, 'myMethod');
    expect(content.substring(range.start, range.end)).toBe('void myMethod() {}');
  });

  it('resolves enum', () => {
    const content = 'enum MyEnum { a, b }';
    const range = dartAdapter.resolveSymbolDeclarationRange(content, 'MyEnum');
    expect(content.substring(range.start, range.end)).toBe('enum MyEnum { a, b }');
  });

  it('resolves mixin', () => {
    const content = 'mixin MyMixin {}';
    const range = dartAdapter.resolveSymbolDeclarationRange(content, 'MyMixin');
    expect(content.substring(range.start, range.end)).toBe('mixin MyMixin {}');
  });

  it('resolves extension', () => {
    const content = 'extension MyExtension on String {}';
    const range = dartAdapter.resolveSymbolDeclarationRange(content, 'MyExtension');
    expect(content.substring(range.start, range.end)).toBe('extension MyExtension on String {}');
  });

  it('resolves top-level variable', () => {
    const content = 'int myVar = 1;';
    const range = dartAdapter.resolveSymbolDeclarationRange(content, 'myVar');
    expect(content.substring(range.start, range.end)).toBe('int myVar = 1;');
  });

  it('resolves field in class', () => {
    const content = 'class A {\n  int myField = 0;\n}';
    const range = dartAdapter.resolveSymbolDeclarationRange(content, 'myField');
    expect(content.substring(range.start, range.end)).toBe('int myField = 0;');
  });

  it('resolves named constructor', () => {
    const content = 'class A { A.named(); }';
    const range = dartAdapter.resolveSymbolDeclarationRange(content, 'A.named');
    expect(content.substring(range.start, range.end)).toBe('A.named();');
  });

  it('resolves default constructor', () => {
    const content = 'class A { A(); }';
    // NAME: A matches both ClassDeclaration and ConstructorDeclaration, which is ambiguous.
    expect(() => dartAdapter.resolveSymbolDeclarationRange(content, 'A'))
      .toThrow(/Structural symbol target is ambiguous/);
  });

  it('resolves typedef', () => {
    const content = 'typedef MyList = List<int>;';
    const range = dartAdapter.resolveSymbolDeclarationRange(content, 'MyList');
    expect(content.substring(range.start, range.end)).toBe('typedef MyList = List<int>;');
  });

  it('throws error for non-existent symbol', () => {
    const content = 'void hello() {}';
    expect(() => dartAdapter.resolveSymbolDeclarationRange(content, 'nonExistent'))
      .toThrow(/Structural symbol target not found/);
  });

  it('throws error for ambiguous symbol', () => {
    const content = 'void same() {} \n class A { void same() {} }';
    expect(() => dartAdapter.resolveSymbolDeclarationRange(content, 'same'))
      .toThrow(/Structural symbol target is ambiguous/);
  });

  it('validates correct candidate', () => {
    const content = 'void main() { print("ok"); }';
    expect(() => dartAdapter.validateCandidate('test.dart', content)).not.toThrow();
  });

  it('throws for invalid candidate', () => {
    const content = 'void main() { print("missing closing" }';
    expect(() => dartAdapter.validateCandidate('test.dart', content))
      .toThrow(/INSCRIBE_PARSE_ERROR/);
  });
});
