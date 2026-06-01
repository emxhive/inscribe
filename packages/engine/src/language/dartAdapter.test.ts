import { execFileSync } from 'child_process';
import { describe, it, expect } from 'vitest';
import { dartAdapter } from './dartAdapter';

function hasDartRuntime(): boolean {
  try {
    execFileSync('dart --version', { stdio: 'ignore', shell: true });
    return true;
  } catch {
    return false;
  }
}

const describeDart = hasDartRuntime() ? describe : describe.skip;
const DART_TEST_TIMEOUT = 60_000;

describeDart('dartAdapter', () => {
  it('supports .dart files only', () => {
    expect(dartAdapter.supportsFile('test.dart')).toBe(true);
    expect(dartAdapter.supportsFile('test.js')).toBe(false);
  });

  it('resolves top-level functions while ignoring comments and strings', () => {
    const content = [
      '// void hello() {}',
      'const fake = "void hello() {}";',
      '@pragma("vm:prefer-inline")',
      'void hello() {',
      '  print(fake);',
      '}',
    ].join('\n');

    const range = dartAdapter.resolveSymbolDeclarationRange(content, 'hello');
    expect(content.slice(range.start, range.end)).toBe([
      '@pragma("vm:prefer-inline")',
      'void hello() {',
      '  print(fake);',
      '}',
    ].join('\n'));
  }, DART_TEST_TIMEOUT);

  it('resolves classes, mixins, enums, extensions, and typedefs', () => {
    const content = [
      'class Service {}',
      'mixin Reusable {}',
      'enum Status { ready }',
      'extension TextTools on String {}',
      'typedef Mapper = String Function(int value);',
    ].join('\n');

    expect(content.slice(...rangeTuple(dartAdapter.resolveSymbolDeclarationRange(content, 'Service')))).toBe('class Service {}');
    expect(content.slice(...rangeTuple(dartAdapter.resolveSymbolDeclarationRange(content, 'Reusable')))).toBe('mixin Reusable {}');
    expect(content.slice(...rangeTuple(dartAdapter.resolveSymbolDeclarationRange(content, 'Status')))).toBe('enum Status { ready }');
    expect(content.slice(...rangeTuple(dartAdapter.resolveSymbolDeclarationRange(content, 'TextTools')))).toBe('extension TextTools on String {}');
    expect(content.slice(...rangeTuple(dartAdapter.resolveSymbolDeclarationRange(content, 'Mapper')))).toBe('typedef Mapper = String Function(int value);');
  }, DART_TEST_TIMEOUT);

  it('resolves methods with modifiers and nested blocks', () => {
    const content = [
      'class Service {',
      '  static Future<void> load() async {',
      '    if (true) {',
      '      print("load");',
      '    }',
      '  }',
      '}',
    ].join('\n');

    const range = dartAdapter.resolveSymbolDeclarationRange(content, 'load');
    expect(content.slice(range.start, range.end)).toBe([
      'static Future<void> load() async {',
      '    if (true) {',
      '      print("load");',
      '    }',
      '  }',
    ].join('\n'));
  }, DART_TEST_TIMEOUT);

  it('requires constructor symbols to be qualified', () => {
    const content = [
      'class Account {',
      '  Account();',
      '  Account.named();',
      '}',
    ].join('\n');

    expect(content.slice(...rangeTuple(dartAdapter.resolveSymbolDeclarationRange(content, 'Account')))).toBe(content);
    expect(content.slice(...rangeTuple(dartAdapter.resolveSymbolDeclarationRange(content, 'Account.new')))).toBe('Account();');
    expect(content.slice(...rangeTuple(dartAdapter.resolveSymbolDeclarationRange(content, 'Account.named')))).toBe('Account.named();');
  }, DART_TEST_TIMEOUT);

  it('treats repeated method names in different classes as ambiguous', () => {
    const content = [
      'class A { void save() {} }',
      'class B { void save() {} }',
    ].join('\n');

    expect(() => dartAdapter.resolveSymbolDeclarationRange(content, 'save'))
      .toThrow(/Structural symbol target is ambiguous/);
  }, DART_TEST_TIMEOUT);

  it('does not resolve multi-variable declarations as a single symbol', () => {
    const content = 'final alpha = 1, beta = 2;';
    expect(() => dartAdapter.resolveSymbolDeclarationRange(content, 'alpha'))
      .toThrow(/Structural symbol target not found/);
  }, DART_TEST_TIMEOUT);

  it('fails safely for missing symbols and malformed source', () => {
    expect(() => dartAdapter.resolveSymbolDeclarationRange('void hello() {}', 'missing'))
      .toThrow(/Structural symbol target not found/);

    expect(() => dartAdapter.resolveSymbolDeclarationRange('void hello( {', 'hello'))
      .toThrow(/Structural Dart source could not be parsed/);
  }, DART_TEST_TIMEOUT);

  it('validates candidates before write', () => {
    expect(() => dartAdapter.validateCandidate('test.dart', 'void main() { print("ok"); }')).not.toThrow();
    expect(() => dartAdapter.validateCandidate('test.dart', 'void main() { print("missing closing" }'))
      .toThrow(/INSCRIBE_PARSE_ERROR/);
  }, DART_TEST_TIMEOUT);
});

function rangeTuple(range: { start: number; end: number }): [number, number] {
  return [range.start, range.end];
}
