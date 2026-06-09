import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock child_process.spawnSync before importing the adapter
// ---------------------------------------------------------------------------

const spawnSyncMock = vi.hoisted(() => vi.fn());

vi.mock('child_process', () => ({
  spawnSync: spawnSyncMock,
}));

// dartAdapter uses __dirname for the helper path; provide a stable value.
vi.mock('path', async (importOriginal) => {
  const actual = await importOriginal<typeof import('path')>();
  return {
    ...actual,
    resolve: (...args: string[]) => {
      // When the adapter resolves the helper path, return a recognizable stub.
      if (args.some((a) => a.includes('inscribe_dart_helper'))) {
        return '/stub/bin/inscribe_dart_helper.dart';
      }
      return actual.resolve(...args);
    },
  };
});

import { dartAdapter } from '../src/language/dartAdapter';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a successful spawnSync result with `symbols` payload. */
function okSymbols(symbols: object[]) {
  return {
    status: 0,
    stdout: JSON.stringify({ ok: true, symbols }),
    stderr: '',
    error: undefined,
  };
}

/** Build a successful spawnSync result for validate_syntax. */
function okValidate() {
  return {
    status: 0,
    stdout: JSON.stringify({ ok: true }),
    stderr: '',
    error: undefined,
  };
}

/** Build an error helper response. */
function errResponse(message: string, extra: object = {}) {
  return {
    status: 1,
    stdout: JSON.stringify({ ok: false, error: message, ...extra }),
    stderr: '',
    error: undefined,
  };
}

function rangeTuple(r: { start: number; end: number }): [number, number] {
  return [r.start, r.end];
}

// ---------------------------------------------------------------------------
// 1. supportsFile — extension gating
// ---------------------------------------------------------------------------

describe('dartAdapter.supportsFile', () => {
  it('accepts .dart files', () => {
    expect(dartAdapter.supportsFile('lib/src/user_service.dart')).toBe(true);
    expect(dartAdapter.supportsFile('main.dart')).toBe(true);
  });

  it('rejects non-Dart files', () => {
    expect(dartAdapter.supportsFile('lib/src/user.ts')).toBe(false);
    expect(dartAdapter.supportsFile('lib/src/user.php')).toBe(false);
    expect(dartAdapter.supportsFile('lib/src/user.js')).toBe(false);
    expect(dartAdapter.supportsFile('README.md')).toBe(false);
    expect(dartAdapter.supportsFile('nodart')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. Symbol resolution — focused mock-based tests
// ---------------------------------------------------------------------------

describe('dartAdapter.resolveSymbolDeclarationRange — symbol types', () => {
  beforeEach(() => {
    spawnSyncMock.mockReset();
  });

  const src = 'class UserService { void save() {} }              '; // len 50

  it('resolves a class by bare name', () => {
    spawnSyncMock.mockReturnValue(
      okSymbols([
        { name: 'UserService', owner: null, kind: 'class', start: 0, end: 36, description: 'Dart class UserService' },
      ]),
    );
    const r = dartAdapter.resolveSymbolDeclarationRange(src, 'UserService');
    expect(r.start).toBe(0);
    expect(r.end).toBe(36);
    expect(r.description).toBe('Dart class UserService');
    expect(src.slice(r.start, r.end)).toBe('class UserService { void save() {} }');

    // Assert the arguments passed to spawnSync
    expect(spawnSyncMock).toHaveBeenLastCalledWith(
      process.platform === 'win32' ? (process.env.ComSpec ?? 'cmd.exe') : 'dart',
      process.platform === 'win32'
        ? ['/d', '/s', '/c', 'dart run "bin/inscribe_dart_helper.dart"']
        : ['run', 'bin/inscribe_dart_helper.dart'],
      expect.objectContaining({
        shell: false,
        cwd: expect.stringContaining('dart_helper'),
        input: JSON.stringify({ action: 'collect_symbols', content: src }),
      }),
    );
  });

  it('resolves an enum by bare name', () => {
    const source = 'enum DrawState { draft }';
    spawnSyncMock.mockReturnValue(
      okSymbols([
        { name: 'DrawState', owner: null, kind: 'enum', start: 0, end: 24, description: 'Dart enum DrawState' },
      ]),
    );
    const r = dartAdapter.resolveSymbolDeclarationRange(source, 'DrawState');
    expect(r.start).toBe(0);
    expect(r.end).toBe(24);
    expect(source.slice(r.start, r.end)).toBe(source);
  });

  it('resolves a mixin by bare name', () => {
    const source = 'mixin Paintable {}';
    spawnSyncMock.mockReturnValue(
      okSymbols([
        { name: 'Paintable', owner: null, kind: 'mixin', start: 0, end: 18, description: 'Dart mixin Paintable' },
      ]),
    );
    const r = dartAdapter.resolveSymbolDeclarationRange(source, 'Paintable');
    expect(r.start).toBe(0);
    expect(r.end).toBe(18);
    expect(source.slice(r.start, r.end)).toBe(source);
  });

  it('resolves an extension by bare name', () => {
    const source = 'extension StringX on String {}';
    spawnSyncMock.mockReturnValue(
      okSymbols([
        { name: 'StringX', owner: null, kind: 'extension', start: 0, end: 30, description: 'Dart extension StringX' },
      ]),
    );
    const r = dartAdapter.resolveSymbolDeclarationRange(source, 'StringX');
    expect(r.start).toBe(0);
    expect(r.end).toBe(30);
    expect(source.slice(r.start, r.end)).toBe(source);
  });

  it('resolves a top-level function by bare name', () => {
    const source = 'void parseUser() {}';
    spawnSyncMock.mockReturnValue(
      okSymbols([
        { name: 'parseUser', owner: null, kind: 'function', start: 0, end: 20, description: 'Dart function parseUser' },
      ]),
    );
    const r = dartAdapter.resolveSymbolDeclarationRange(source, 'parseUser');
    expect(r.start).toBe(0);
    expect(r.end).toBe(20);
    expect(source.slice(r.start, r.end)).toBe(source);
  });

  it('resolves a class method via :: scoped selector', () => {
    spawnSyncMock.mockReturnValue(
      okSymbols([
        { name: 'UserService', owner: null, kind: 'class', start: 0, end: 35, description: 'Dart class UserService' },
        { name: 'save', owner: 'UserService', kind: 'method', start: 20, end: 34, description: 'Dart UserService::save method' },
      ]),
    );
    const r = dartAdapter.resolveSymbolDeclarationRange(src, 'UserService::save');
    expect(r.start).toBe(20);
    expect(r.end).toBe(34);
    expect(r.description).toContain('UserService::save');
    expect(src.slice(r.start, r.end)).toBe('void save() {}');
  });

  it('resolves a class method via . scoped selector', () => {
    spawnSyncMock.mockReturnValue(
      okSymbols([
        { name: 'UserService', owner: null, kind: 'class', start: 0, end: 35, description: 'Dart class UserService' },
        { name: 'save', owner: 'UserService', kind: 'method', start: 20, end: 34, description: 'Dart UserService::save method' },
      ]),
    );
    const r = dartAdapter.resolveSymbolDeclarationRange(src, 'UserService.save');
    expect(r.start).toBe(20);
    expect(r.end).toBe(34);
    expect(src.slice(r.start, r.end)).toBe('void save() {}');
  });

  it('rejects ambiguous bare method names and recommends scoped selectors', () => {
    spawnSyncMock.mockReturnValue(
      okSymbols([
        { name: 'handle', owner: 'FirstAction', kind: 'method', start: 0, end: 30, description: 'Dart FirstAction::handle method' },
        { name: 'handle', owner: 'SecondAction', kind: 'method', start: 40, end: 70, description: 'Dart SecondAction::handle method' },
      ]),
    );
    expect(() => dartAdapter.resolveSymbolDeclarationRange('...', 'handle')).toThrow(
      'Structural symbol target is ambiguous.',
    );
    expect(() => dartAdapter.resolveSymbolDeclarationRange('...', 'handle')).toThrow(
      'Use a scoped selector',
    );
  });

  it('throws not-found for missing symbol', () => {
    spawnSyncMock.mockReturnValue(okSymbols([]));
    expect(() => dartAdapter.resolveSymbolDeclarationRange('class Foo {}', 'Bar')).toThrow(
      'Structural symbol target not found.',
    );
  });

  it('resolves unnamed constructor via :: new selector', () => {
    const source = 'class UserService { UserService(); }';
    spawnSyncMock.mockReturnValue(
      okSymbols([
        { name: 'new', owner: 'UserService', kind: 'constructor', start: 20, end: 34, description: 'Dart UserService::new constructor' },
      ]),
    );
    const r = dartAdapter.resolveSymbolDeclarationRange(source, 'UserService::new');
    expect(r.start).toBe(20);
    expect(r.end).toBe(34);
    expect(source.slice(r.start, r.end)).toBe('UserService();');
  });

  it('resolves named constructor via :: fromJson selector', () => {
    const source = 'class UserService { UserService.fromJson(); }';
    spawnSyncMock.mockReturnValue(
      okSymbols([
        { name: 'fromJson', owner: 'UserService', kind: 'constructor', start: 20, end: 43, description: 'Dart UserService::fromJson constructor' },
      ]),
    );
    const r = dartAdapter.resolveSymbolDeclarationRange(source, 'UserService::fromJson');
    expect(r.start).toBe(20);
    expect(r.end).toBe(43);
    expect(source.slice(r.start, r.end)).toBe('UserService.fromJson();');
  });
});

// ---------------------------------------------------------------------------
// 3. Annotation + doc comment inclusion
// ---------------------------------------------------------------------------

describe('dartAdapter — annotation and doc comment coverage', () => {
  beforeEach(() => spawnSyncMock.mockReset());

  it('includes annotations in the returned range start', () => {
    const source = '@Injectable\nclass PaymentService {}';
    spawnSyncMock.mockReturnValue(
      okSymbols([
        { name: 'PaymentService', owner: null, kind: 'class', start: 0, end: 36, description: 'Dart class PaymentService' },
      ]),
    );
    const r = dartAdapter.resolveSymbolDeclarationRange(source, 'PaymentService');
    expect(r.start).toBe(0);
    expect(source.slice(r.start, r.end)).toBe(source);
  });

  it('includes documentation comments in the returned range start', () => {
    const source = '/// Parses a user.\nvoid parseUser() {}';
    spawnSyncMock.mockReturnValue(
      okSymbols([
        { name: 'parseUser', owner: null, kind: 'function', start: 0, end: 39, description: 'Dart function parseUser' },
      ]),
    );
    const r = dartAdapter.resolveSymbolDeclarationRange(source, 'parseUser');
    expect(r.start).toBe(0);
    expect(source.slice(r.start, r.end)).toBe(source);
  });

  it('does not absorb unrelated preceding comment — start is at annotation/decl', () => {
    const source = '// unrelated\n\nclass Foo {}';
    spawnSyncMock.mockReturnValue(
      okSymbols([
        { name: 'Foo', owner: null, kind: 'class', start: 14, end: 26, description: 'Dart class Foo' },
      ]),
    );
    const r = dartAdapter.resolveSymbolDeclarationRange(source, 'Foo');
    expect(r.start).toBe(14);
    expect(source.slice(r.start, r.end)).not.toContain('unrelated');
    expect(source.slice(r.start, r.end)).toBe('class Foo {}');
  });
});

// ---------------------------------------------------------------------------
// 4. Edge cases
// ---------------------------------------------------------------------------

describe('dartAdapter — edge cases', () => {
  beforeEach(() => spawnSyncMock.mockReset());

  it('handles braces inside string literals without misidentifying symbols', () => {
    spawnSyncMock.mockReturnValue(
      okSymbols([
        { name: 'Formatter', owner: null, kind: 'class', start: 0, end: 58, description: 'Dart class Formatter' },
        { name: 'format', owner: 'Formatter', kind: 'method', start: 18, end: 57, description: 'Dart Formatter::format method' },
      ]),
    );
    const source = "class Formatter { String format() { return '{ hello }'; } }";
    const r = dartAdapter.resolveSymbolDeclarationRange(source, 'Formatter::format');
    expect(r.start).toBe(18);
    expect(r.end).toBe(57);
    expect(source.slice(r.start, r.end)).toBe("String format() { return '{ hello }'; }");
  });

  it('returns UTF-16 compatible offsets for source with non-BMP Unicode before a declaration', () => {
    spawnSyncMock.mockReturnValue(
      okSymbols([
        { name: 'Greet', owner: null, kind: 'class', start: 9, end: 23, description: 'Dart class Greet' },
      ]),
    );
    const source = '/* 😀 */\nclass Greet {}';
    const r = dartAdapter.resolveSymbolDeclarationRange(source, 'Greet');
    expect(source.slice(r.start, r.end)).toBe('class Greet {}');
  });
});

// ---------------------------------------------------------------------------
// 5. Candidate validation
// ---------------------------------------------------------------------------

describe('dartAdapter.validateCandidate', () => {
  beforeEach(() => spawnSyncMock.mockReset());

  it('passes valid Dart syntax without throwing', () => {
    spawnSyncMock.mockReturnValue(okValidate());
    expect(() => dartAdapter.validateCandidate?.('lib/src/user.dart', 'class Foo {}')).not.toThrow();
  });

  it('throws INSCRIBE_PARSE_ERROR for invalid Dart syntax', () => {
    spawnSyncMock.mockReturnValue(
      errResponse('Syntax error at line 1, column 7: Expected \';\''),
    );
    expect(() => dartAdapter.validateCandidate?.('lib/src/user.dart', 'class {')).toThrow(
      [
        'INSCRIBE_PARSE_ERROR',
        'File: lib/src/user.dart',
        'Operation: dart_candidate_validation',
        'Status: blocked_before_write',
      ].join('\n'),
    );
  });

  it('INSCRIBE_PARSE_ERROR mentions the file path', () => {
    spawnSyncMock.mockReturnValue(errResponse('Syntax error at line 2, column 1: Unexpected token'));
    expect(() => dartAdapter.validateCandidate?.('lib/auth/login_service.dart', 'bad source')).toThrow(
      'File: lib/auth/login_service.dart',
    );
  });

  it('reports that the real file was not modified', () => {
    spawnSyncMock.mockReturnValue(errResponse('Syntax error at line 1, column 1: oops'));
    expect(() => dartAdapter.validateCandidate?.('lib/src/x.dart', 'bad')).toThrow(
      'The real file was not modified.',
    );
  });
});

// ---------------------------------------------------------------------------
// 6. Process error handling
// ---------------------------------------------------------------------------

describe('dartAdapter — process error handling', () => {
  beforeEach(() => spawnSyncMock.mockReset());

  it('throws a useful diagnostic when dart executable is missing', () => {
    const enoent = Object.assign(new Error('spawn dart ENOENT'), { code: 'ENOENT' });
    spawnSyncMock.mockReturnValue({ status: null, stdout: '', stderr: '', error: enoent });
    expect(() => dartAdapter.resolveSymbolDeclarationRange('class Foo {}', 'Foo')).toThrow(
      'Dart executable not found',
    );
  });

  it('throws a useful diagnostic when helper emits malformed JSON', () => {
    spawnSyncMock.mockReturnValue({ status: 0, stdout: 'not-json', stderr: '', error: undefined });
    expect(() => dartAdapter.resolveSymbolDeclarationRange('class Foo {}', 'Foo')).toThrow(
      'malformed JSON',
    );
  });

  it('throws when helper stdout is empty', () => {
    spawnSyncMock.mockReturnValue({ status: 1, stdout: '', stderr: 'something crashed', error: undefined });
    expect(() => dartAdapter.resolveSymbolDeclarationRange('class Foo {}', 'Foo')).toThrow(
      'no stdout output',
    );
  });
});
