@Timeout(Duration(minutes: 3))
import 'dart:convert';
import 'dart:io';

import 'package:test/test.dart';

// ---------------------------------------------------------------------------
// Helpers to invoke the helper binary as a subprocess
// ---------------------------------------------------------------------------

final String _helperPath = '${Directory.current.path}/bin/inscribe_dart_helper.dart';

Future<Map<String, dynamic>> _runHelper(Map<String, dynamic> request) async {
  final process = await Process.start(
    'dart',
    ['run', _helperPath],
  );
  process.stdin.writeln(json.encode(request));
  await process.stdin.close();

  final stdoutString = await process.stdout.transform(utf8.decoder).join();
  final stderrString = await process.stderr.transform(utf8.decoder).join();

  expect(stdoutString.trim(), isNotEmpty,
      reason: 'Helper produced empty stdout. stderr: $stderrString');
  return json.decode(stdoutString.trim()) as Map<String, dynamic>;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

void main() {
  group('collect_symbols — top-level declarations', () {
    test('resolves a class', () async {
      final source = 'class UserService { void save() {} }';
      final resp = await _runHelper({'action': 'collect_symbols', 'content': source});
      expect(resp['ok'], isTrue);
      final symbols = resp['symbols'] as List;
      final cls = symbols.firstWhere(
        (s) => s['name'] == 'UserService' && s['kind'] == 'class',
        orElse: () => null,
      );
      expect(cls, isNotNull);
      expect(source.substring(cls['start'] as int, cls['end'] as int),
          contains('UserService'));
    });

    test('resolves an enum', () async {
      final source = 'enum Status { active, inactive }';
      final resp = await _runHelper({'action': 'collect_symbols', 'content': source});
      final symbols = resp['symbols'] as List;
      final enm = symbols.firstWhere(
        (s) => s['name'] == 'Status' && s['kind'] == 'enum',
        orElse: () => null,
      );
      expect(enm, isNotNull);
    });

    test('resolves a mixin', () async {
      final source = 'mixin Serializable { String toJson() => "{}"; }';
      final resp = await _runHelper({'action': 'collect_symbols', 'content': source});
      final symbols = resp['symbols'] as List;
      final mixin_ = symbols.firstWhere(
        (s) => s['name'] == 'Serializable' && s['kind'] == 'mixin',
        orElse: () => null,
      );
      expect(mixin_, isNotNull);
    });

    test('resolves an extension', () async {
      final source = 'extension StringOps on String { bool get isBlank => trim().isEmpty; }';
      final resp = await _runHelper({'action': 'collect_symbols', 'content': source});
      final symbols = resp['symbols'] as List;
      final ext = symbols.firstWhere(
        (s) => s['name'] == 'StringOps' && s['kind'] == 'extension',
        orElse: () => null,
      );
      expect(ext, isNotNull);
    });

    test('resolves a top-level function', () async {
      final source = 'void processUser(String id) {}';
      final resp = await _runHelper({'action': 'collect_symbols', 'content': source});
      final symbols = resp['symbols'] as List;
      final fn = symbols.firstWhere(
        (s) => s['name'] == 'processUser' && s['kind'] == 'function',
        orElse: () => null,
      );
      expect(fn, isNotNull);
    });
  });

  group('collect_symbols — class members', () {
    test('resolves a class method with correct owner', () async {
      final source = 'class Repo { Future<void> save() async {} }';
      final resp = await _runHelper({'action': 'collect_symbols', 'content': source});
      final symbols = resp['symbols'] as List;
      final method = symbols.firstWhere(
        (s) => s['name'] == 'save' && s['owner'] == 'Repo' && s['kind'] == 'method',
        orElse: () => null,
      );
      expect(method, isNotNull);
      expect(source.substring(method['start'] as int, method['end'] as int),
          contains('save'));
    });

    test('resolves unnamed constructor as "new"', () async {
      final source = 'class Point { final int x; Point(this.x); }';
      final resp = await _runHelper({'action': 'collect_symbols', 'content': source});
      final symbols = resp['symbols'] as List;
      final ctor = symbols.firstWhere(
        (s) => s['name'] == 'new' && s['owner'] == 'Point' && s['kind'] == 'constructor',
        orElse: () => null,
      );
      expect(ctor, isNotNull);
    });

    test('resolves named constructor', () async {
      final source = 'class Point { int x; Point.fromJson(Map m) : x = m["x"]; }';
      final resp = await _runHelper({'action': 'collect_symbols', 'content': source});
      final symbols = resp['symbols'] as List;
      final ctor = symbols.firstWhere(
        (s) =>
            s['name'] == 'fromJson' &&
            s['owner'] == 'Point' &&
            s['kind'] == 'constructor',
        orElse: () => null,
      );
      expect(ctor, isNotNull);
    });
  });

  group('collect_symbols — annotations and doc comments', () {
    test('includes annotations in the range start', () async {
      final source = '@deprecated\nclass OldService {}';
      final resp = await _runHelper({'action': 'collect_symbols', 'content': source});
      final symbols = resp['symbols'] as List;
      final cls = symbols.firstWhere(
        (s) => s['name'] == 'OldService' && s['kind'] == 'class',
        orElse: () => null,
      );
      expect(cls, isNotNull);
      // Range must start at the annotation, not after it.
      expect(cls['start'] as int, lessThanOrEqualTo(source.indexOf('@deprecated')));
      expect(source.substring(cls['start'] as int, cls['end'] as int),
          contains('@deprecated'));
    });

    test('includes documentation comment in the range', () async {
      final source = '/// A user service.\nclass UserService {}';
      final resp = await _runHelper({'action': 'collect_symbols', 'content': source});
      final symbols = resp['symbols'] as List;
      final cls = symbols.firstWhere(
        (s) => s['name'] == 'UserService' && s['kind'] == 'class',
        orElse: () => null,
      );
      expect(cls, isNotNull);
      expect(source.substring(cls['start'] as int, cls['end'] as int),
          contains('/// A user service.'));
    });

    test('does not absorb unrelated preceding comment', () async {
      // A plain // comment is not a doc comment and should not be owned
      // by the following declaration.
      final source = '// unrelated\n\nclass Foo {}';
      final resp = await _runHelper({'action': 'collect_symbols', 'content': source});
      final symbols = resp['symbols'] as List;
      final cls = symbols.firstWhere(
        (s) => s['name'] == 'Foo' && s['kind'] == 'class',
        orElse: () => null,
      );
      expect(cls, isNotNull);
      // Start must be at "class", not at the unrelated comment.
      expect(source.substring(cls['start'] as int, cls['end'] as int),
          isNot(contains('unrelated')));
    });
  });

  group('collect_symbols — edge cases', () {
    test('handles braces inside string literals', () async {
      final source = "class Fmt { String f() { return '{ ok }'; } }";
      final resp = await _runHelper({'action': 'collect_symbols', 'content': source});
      final symbols = resp['symbols'] as List;
      final method = symbols.firstWhere(
        (s) => s['name'] == 'f' && s['owner'] == 'Fmt',
        orElse: () => null,
      );
      expect(method, isNotNull);
    });

    test('returns UTF-16 compatible offsets with non-BMP characters before declaration', () async {
      // U+1F600 GRINNING FACE is a supplementary-plane character.
      // In both Dart and JavaScript strings it occupies 2 code units.
      final source = '/* 😀 */\nclass Greet {}';
      final resp = await _runHelper({'action': 'collect_symbols', 'content': source});
      final symbols = resp['symbols'] as List;
      final cls = symbols.firstWhere(
        (s) => s['name'] == 'Greet' && s['kind'] == 'class',
        orElse: () => null,
      );
      expect(cls, isNotNull);
      final start = cls['start'] as int;
      final end = cls['end'] as int;
      // Dart substring() uses the same UTF-16 code-unit offsets.
      expect(source.substring(start, end), equals('class Greet {}'));
    });
  });

  group('validate_syntax', () {
    test('returns ok=true for valid Dart', () async {
      final resp = await _runHelper({
        'action': 'validate_syntax',
        'content': 'class Foo { void bar() {} }',
      });
      expect(resp['ok'], isTrue);
    });

    test('returns ok=false with error message for invalid Dart', () async {
      final resp = await _runHelper({
        'action': 'validate_syntax',
        'content': 'class {',
      });
      expect(resp['ok'], isFalse);
      expect(resp['error'], isA<String>());
      expect((resp['error'] as String).toLowerCase(),
          anyOf(contains('syntax'), contains('error'), contains('expected')));
    });
  });

  group('protocol', () {
    test('returns ok=false for unknown action', () async {
      final resp = await _runHelper({'action': 'bogus', 'content': ''});
      expect(resp['ok'], isFalse);
      expect(resp['error'], contains('Unknown action'));
    });

    test('returns ok=false when content field is missing', () async {
      final process = await Process.start(
        'dart',
        ['run', _helperPath],
      );
      process.stdin.writeln('{"action":"collect_symbols"}');
      await process.stdin.close();

      final stdoutString = await process.stdout.transform(utf8.decoder).join();
      final out = json.decode(stdoutString.trim());
      expect(out['ok'], isFalse);
      expect(out['error'], contains('content'));
    });
  });
}
