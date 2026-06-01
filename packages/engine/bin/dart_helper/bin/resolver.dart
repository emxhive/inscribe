import 'dart:io';
import 'dart:convert';
import 'package:analyzer/dart/analysis/utilities.dart';
import 'package:analyzer/dart/ast/ast.dart';
import 'package:analyzer/dart/ast/visitor.dart';
import 'package:analyzer/source/line_info.dart';

void main(List<String> args) {
  if (args.length < 2) {
    stderr.writeln('Usage: resolver.dart <file_path> <symbol_name>');
    exit(1);
  }

  final filePath = args[0];
  final symbolName = args[1];
  String content;
  try {
    content = File(filePath).readAsStringSync();
  } catch (e) {
    stderr.writeln('ERROR_READING_FILE: $e');
    exit(1);
  }

  final result = parseString(content: content, throwIfDiagnostics: false);
  final errors = result.errors.where((error) => error.severity.name.toLowerCase() == 'error').toList();
  if (errors.isNotEmpty) {
    print(jsonEncode({
      'status': 'PARSE_ERROR',
      'message': _formatDiagnostics(result.lineInfo, errors),
    }));
    exit(0);
  }

  final unit = result.unit;

  final visitor = SymbolVisitor(symbolName);
  unit.accept(visitor);

  if (visitor.matches.isEmpty) {
    print(jsonEncode({'status': 'NOT_FOUND'}));
    exit(0);
  }

  if (visitor.matches.length > 1) {
    print(jsonEncode({
      'status': 'AMBIGUOUS',
      'matches': visitor.matches.map((m) => m.description).toList(),
    }));
    exit(0);
  }

  final match = visitor.matches.first;
  print(jsonEncode({
    'status': 'SUCCESS',
    'start': match.start,
    'end': match.end,
    'description': match.description,
  }));
}

class SymbolMatch {
  final int start;
  final int end;
  final String description;
  SymbolMatch(this.start, this.end, this.description);
}

String _formatDiagnostics(LineInfo lineInfo, List<dynamic> errors) {
  return errors.map((error) {
    final location = lineInfo.getLocation(error.offset);
    return 'line ${location.lineNumber}, column ${location.columnNumber}: ${error.message}';
  }).join('; ');
}

class SymbolVisitor extends RecursiveAstVisitor<void> {
  final String name;
  final List<SymbolMatch> matches = [];

  SymbolVisitor(this.name);

  void _addMatch(AstNode node, String type) {
    final root = node.root;
    final start = _declarationStart(node);
    int line = 0;
    if (root is CompilationUnit) {
      line = root.lineInfo.getLocation(start).lineNumber;
    }
    matches.add(SymbolMatch(start, node.end, '$type at line $line'));
  }

  int _declarationStart(AstNode node) {
    if (node is AnnotatedNode && node.metadata.isNotEmpty) {
      return node.metadata.first.offset;
    }
    return node.offset;
  }

  @override
  void visitFunctionDeclaration(FunctionDeclaration node) {
    if (node.parent is CompilationUnit && node.name.lexeme == name) {
      _addMatch(node, 'FunctionDeclaration');
    }
    super.visitFunctionDeclaration(node);
  }

  @override
  void visitClassDeclaration(ClassDeclaration node) {
    if (node.name.lexeme == name) {
      _addMatch(node, 'ClassDeclaration');
    }
    super.visitClassDeclaration(node);
  }

  @override
  void visitMethodDeclaration(MethodDeclaration node) {
    if (node.name.lexeme == name) {
      _addMatch(node, 'MethodDeclaration');
    }
    super.visitMethodDeclaration(node);
  }

  @override
  void visitEnumDeclaration(EnumDeclaration node) {
    if (node.name.lexeme == name) {
      _addMatch(node, 'EnumDeclaration');
    }
    super.visitEnumDeclaration(node);
  }

  @override
  void visitMixinDeclaration(MixinDeclaration node) {
    if (node.name.lexeme == name) {
      _addMatch(node, 'MixinDeclaration');
    }
    super.visitMixinDeclaration(node);
  }

  @override
  void visitExtensionDeclaration(ExtensionDeclaration node) {
    if (node.name?.lexeme == name) {
      _addMatch(node, 'ExtensionDeclaration');
    }
    super.visitExtensionDeclaration(node);
  }

  @override
  void visitFieldDeclaration(FieldDeclaration node) {
    if (node.fields.variables.length != 1) {
      super.visitFieldDeclaration(node);
      return;
    }
    for (var variable in node.fields.variables) {
      if (variable.name.lexeme == name) {
        _addMatch(node, 'FieldDeclaration');
      }
    }
    super.visitFieldDeclaration(node);
  }

  @override
  void visitTopLevelVariableDeclaration(TopLevelVariableDeclaration node) {
    if (node.variables.variables.length != 1) {
      super.visitTopLevelVariableDeclaration(node);
      return;
    }
    for (var variable in node.variables.variables) {
      if (variable.name.lexeme == name) {
        _addMatch(node, 'TopLevelVariableDeclaration');
      }
    }
    super.visitTopLevelVariableDeclaration(node);
  }

  @override
  void visitConstructorDeclaration(ConstructorDeclaration node) {
    final constructorName = node.name?.lexeme;
    final className = node.returnType.name;
    final fullName = constructorName != null ? '$className.$constructorName' : '$className.new';

    if (fullName == name) {
      _addMatch(node, 'ConstructorDeclaration');
    }
    super.visitConstructorDeclaration(node);
  }

  @override
  void visitGenericTypeAlias(GenericTypeAlias node) {
    if (node.name.lexeme == name) {
      _addMatch(node, 'GenericTypeAlias');
    }
    super.visitGenericTypeAlias(node);
  }

  @override
  void visitFunctionTypeAlias(FunctionTypeAlias node) {
    if (node.name.lexeme == name) {
      _addMatch(node, 'FunctionTypeAlias');
    }
    super.visitFunctionTypeAlias(node);
  }
}
