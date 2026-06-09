// inscribe_dart_helper — reads one JSON request from stdin, writes one JSON
// response to stdout, then exits.
//
// Protocol:
//
//   Request  { "action": "collect_symbols" | "validate_syntax", "content": "<dart source>" }
//   Response { "ok": true,  "symbols": [...] }             // collect_symbols success
//   Response { "ok": true  }                               // validate_syntax success
//   Response { "ok": false, "error": "<message>", ... }    // any failure
//
// Symbol object:
//   { "name": str, "owner": str|null, "kind": str,
//     "start": int, "end": int, "description": str }
//
// Offsets are Dart string (UTF-16 code-unit) indices, which are identical to
// JavaScript String offsets, so Node can call source.slice(start, end) directly.
//
// IMPORTANT: Do NOT print anything to stdout except the single JSON response line.
// Use stderr for optional diagnostic logs.

import 'dart:convert';
import 'dart:io';

import 'package:analyzer/dart/analysis/features.dart';
import 'package:analyzer/dart/analysis/utilities.dart';
import 'package:analyzer/dart/ast/ast.dart';
import 'package:analyzer/dart/ast/visitor.dart';
import 'package:analyzer/error/error.dart';

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

void main() {
  final rawInput = stdin.readLineSync(encoding: utf8);
  if (rawInput == null || rawInput.trim().isEmpty) {
    _respondError('Empty stdin');
    return;
  }

  Map<String, dynamic> request;
  try {
    request = (json.decode(rawInput) as Map<String, dynamic>);
  } catch (_) {
    _respondError('Failed to parse request JSON');
    return;
  }

  final action = request['action'] as String?;
  final content = request['content'] as String?;

  if (content == null) {
    _respondError('Missing required field: content');
    return;
  }

  switch (action) {
    case 'collect_symbols':
      _handleCollectSymbols(content);
    case 'validate_syntax':
      _handleValidateSyntax(content);
    default:
      _respondError('Unknown action: $action');
  }
}

// ---------------------------------------------------------------------------
// collect_symbols
// ---------------------------------------------------------------------------

void _handleCollectSymbols(String content) {
  try {
    final result = parseString(
      content: content,
      featureSet: FeatureSet.latestLanguageVersion(),
      throwIfDiagnostics: false,
    );

    final errors = result.errors
        .where((e) => e.severity.name.toUpperCase() == 'ERROR')
        .toList();

    if (errors.isNotEmpty) {
      final first = errors.first;
      final lineInfo = result.unit.lineInfo;
      final loc = lineInfo.getLocation(first.offset);
      _respondError(
        'Syntax error at line ${loc.lineNumber}, '
        'column ${loc.columnNumber}: ${first.message}',
        line: loc.lineNumber,
        column: loc.columnNumber,
      );
      return;
    }

    final collector = _SymbolCollector();
    result.unit.accept(collector);

    final symbols =
        collector.symbols.map((s) => s.toJson()).toList(growable: false);
    stdout.writeln(json.encode({'ok': true, 'symbols': symbols}));
  } catch (e, st) {
    stderr.writeln('collect_symbols exception: $e\n$st');
    _respondError('collect_symbols failed: $e');
  }
}

// ---------------------------------------------------------------------------
// validate_syntax
// ---------------------------------------------------------------------------

void _handleValidateSyntax(String content) {
  try {
    final result = parseString(
      content: content,
      featureSet: FeatureSet.latestLanguageVersion(),
      throwIfDiagnostics: false,
    );

    // Only surface ERROR-severity diagnostics (not INFO, WARNING, HINT).
    final errors = result.errors
        .where((e) => e.severity.name.toUpperCase() == 'ERROR')
        .toList();

    if (errors.isEmpty) {
      stdout.writeln(json.encode({'ok': true}));
      return;
    }

    final first = errors.first;
    final lineInfo = result.unit.lineInfo;
    final loc = lineInfo.getLocation(first.offset);

    _respondError(
      'Syntax error at line ${loc.lineNumber}, '
      'column ${loc.columnNumber}: ${first.message}',
      line: loc.lineNumber,
      column: loc.columnNumber,
    );
  } catch (e, st) {
    stderr.writeln('validate_syntax exception: $e\n$st');
    _respondError('validate_syntax failed: $e');
  }
}

// ---------------------------------------------------------------------------
// Symbol collection visitor
// ---------------------------------------------------------------------------

class _Symbol {
  final String name;
  final String? owner;
  final String kind;
  final int start;
  final int end;
  final String description;

  const _Symbol({
    required this.name,
    required this.owner,
    required this.kind,
    required this.start,
    required this.end,
    required this.description,
  });

  Map<String, dynamic> toJson() => {
        'name': name,
        'owner': owner,
        'kind': kind,
        'start': start,
        'end': end,
        'description': description,
      };
}

class _SymbolCollector extends RecursiveAstVisitor<void> {
  final List<_Symbol> symbols = [];

  _SymbolCollector();

  // ------------------------------------------------------------------
  // Offset helpers
  // ------------------------------------------------------------------

  /// Effective start of [node], extended leftward to include any attached
  /// annotations and documentation comment owned by this declaration.
  int _declStart(AnnotatedNode node) {
    int start = node.offset;

    // Documentation comment directly owned by this declaration node.
    final doc = node.documentationComment;
    if (doc != null && doc.offset < start) {
      start = doc.offset;
    }

    // Annotations (@Foo, @Foo.bar(), etc.).
    for (final annotation in node.metadata) {
      if (annotation.offset < start) {
        start = annotation.offset;
      }
    }

    return start;
  }

  // ------------------------------------------------------------------
  // Top-level declarations
  // ------------------------------------------------------------------

  @override
  void visitClassDeclaration(ClassDeclaration node) {
    final name = node.name.lexeme;
    final start = _declStart(node);
    final end = node.end;
    symbols.add(_Symbol(
      name: name,
      owner: null,
      kind: 'class',
      start: start,
      end: end,
      description: 'Dart class $name',
    ));
    // Collect members without recursing into nested function bodies.
    _collectClassMembers(node.members, name);
  }

  @override
  void visitEnumDeclaration(EnumDeclaration node) {
    final name = node.name.lexeme;
    final start = _declStart(node);
    final end = node.end;
    symbols.add(_Symbol(
      name: name,
      owner: null,
      kind: 'enum',
      start: start,
      end: end,
      description: 'Dart enum $name',
    ));
    _collectClassMembers(node.members, name);
  }

  @override
  void visitMixinDeclaration(MixinDeclaration node) {
    final name = node.name.lexeme;
    final start = _declStart(node);
    final end = node.end;
    symbols.add(_Symbol(
      name: name,
      owner: null,
      kind: 'mixin',
      start: start,
      end: end,
      description: 'Dart mixin $name',
    ));
    _collectClassMembers(node.members, name);
  }

  @override
  void visitExtensionDeclaration(ExtensionDeclaration node) {
    // Unnamed extensions are not addressable by selector — skip them.
    final name = node.name?.lexeme;
    if (name == null) return;
    final start = _declStart(node);
    final end = node.end;
    symbols.add(_Symbol(
      name: name,
      owner: null,
      kind: 'extension',
      start: start,
      end: end,
      description: 'Dart extension $name',
    ));
    _collectClassMembers(node.members, name);
  }

  @override
  void visitFunctionDeclaration(FunctionDeclaration node) {
    // Only index top-level functions (parent is the compilation unit).
    // Local/nested functions inside other declarations are not tracked.
    if (node.parent is! CompilationUnit) return;
    final name = node.name.lexeme;
    final start = _declStart(node);
    final end = node.end;
    symbols.add(_Symbol(
      name: name,
      owner: null,
      kind: 'function',
      start: start,
      end: end,
      description: 'Dart function $name',
    ));
  }

  // ------------------------------------------------------------------
  // Class / enum / mixin / extension members
  // ------------------------------------------------------------------

  void _collectClassMembers(
      NodeList<ClassMember> members, String ownerName) {
    for (final member in members) {
      if (member is MethodDeclaration) {
        _visitMethodMember(member, ownerName);
      } else if (member is ConstructorDeclaration) {
        _visitConstructorMember(member, ownerName);
      }
      // Fields, getters, setters, operators: intentionally deferred.
    }
  }

  void _visitMethodMember(MethodDeclaration node, String ownerName) {
    // Skip getters and setters per specification.
    if (node.isGetter || node.isSetter) return;
    final name = node.name.lexeme;
    final start = _declStart(node);
    final end = node.end;
    symbols.add(_Symbol(
      name: name,
      owner: ownerName,
      kind: 'method',
      start: start,
      end: end,
      description: 'Dart $ownerName::$name method',
    ));
  }

  void _visitConstructorMember(ConstructorDeclaration node, String ownerName) {
    // Unnamed constructors have a null name token; represent them as "new".
    final name = node.name?.lexeme ?? 'new';
    final start = _declStart(node);
    final end = node.end;
    symbols.add(_Symbol(
      name: name,
      owner: ownerName,
      kind: 'constructor',
      start: start,
      end: end,
      description: 'Dart $ownerName::$name constructor',
    ));
  }
}

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

void _respondError(
  String message, {
  int? line,
  int? column,
}) {
  final response = <String, dynamic>{'ok': false, 'error': message};
  if (line != null) response['line'] = line;
  if (column != null) response['column'] = column;
  stdout.writeln(json.encode(response));
}
