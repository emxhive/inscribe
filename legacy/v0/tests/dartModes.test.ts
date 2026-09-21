import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { applyChanges } from '../src';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('Dart/Flutter textual mode coverage', () => {
  let tempDir: string;
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'inscribe-dart-'));
    fs.mkdirSync(path.join(tempDir, 'lib'), { recursive: true });
  });
  afterEach(() => fs.rmSync(tempDir, { recursive: true, force: true }));

  it('covers create, append, replace, range, delete on dart file', () => {
    const create = applyChanges({ operations: [{ type: 'create', file: 'lib/main.dart', content: 'void main() {\n  print("hello");\n}\n' }] }, tempDir);
    expect(create.success).toBe(true);

    const append = applyChanges({ operations: [{ type: 'append', file: 'lib/main.dart', content: '\n// footer\n' }] }, tempDir);
    expect(append.success).toBe(true);

    const range = applyChanges({ operations: [{ type: 'range', file: 'lib/main.dart', content: '  print("updated");\n', directives: { START: 'print("hello")' } }] }, tempDir);
    expect(range.success).toBe(true);

    const replace = applyChanges({ operations: [{ type: 'replace', file: 'lib/main.dart', content: 'void main() {\n  runApp(const MyApp());\n}\n' }] }, tempDir);
    expect(replace.success).toBe(true);

    const del = applyChanges({ operations: [{ type: 'delete', file: 'lib/main.dart', content: '' }] }, tempDir);
    expect(del.success).toBe(true);
    expect(fs.existsSync(path.join(tempDir, 'lib', 'main.dart'))).toBe(false);
  });

  it('supports anchor combinations in flutter widget file', () => {
    const file = path.join(tempDir, 'lib', 'widget.dart');
    fs.writeFileSync(file, 'class A {\n  Widget build() {\n    return const Placeholder();\n  }\n}\n');
    const op = applyChanges({ operations: [{ type: 'range', file: 'lib/widget.dart', content: '    return const SizedBox.shrink();\n', directives: { START_AFTER: 'Widget build() {', END_BEFORE: '  }' } }] }, tempDir);
    expect(op.success).toBe(true);
    expect(fs.readFileSync(file, 'utf8')).toContain('SizedBox.shrink');
  });
});
