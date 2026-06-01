import 'dart:io';
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

  try {
    parseString(content: content, throwIfDiagnostics: true);
    print('VALID');
  } catch (e) {
    print('INVALID');
    stderr.writeln(e.toString());
    exit(0);
  }
}
