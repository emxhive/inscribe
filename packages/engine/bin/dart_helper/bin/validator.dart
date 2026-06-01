import 'dart:io';
import 'dart:convert';
import 'package:analyzer/dart/analysis/utilities.dart';

void main(List<String> args) {
  if (args.length < 1) {
    stderr.writeln('Usage: validator.dart <file_path>');
    exit(1);
  }

  final filePath = args[0];
  String content;
  try {
    content = File(filePath).readAsStringSync();
  } catch (e) {
    stderr.writeln('ERROR_READING_FILE: $e');
    exit(1);
  }

  final result = parseString(content: content, throwIfDiagnostics: false);
  final errors = result.errors.where((error) => error.severity.name.toLowerCase() == 'error').toList();

  if (errors.isEmpty) {
    print(jsonEncode({'status': 'VALID'}));
    exit(0);
  }

  print(jsonEncode({
    'status': 'INVALID',
    'message': errors.map((error) {
      final location = result.lineInfo.getLocation(error.offset);
      return 'line ${location.lineNumber}, column ${location.columnNumber}: ${error.message}';
    }).join('; '),
  }));
}
