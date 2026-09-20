import { describe, expect, it } from 'vitest';
import * as path from 'path';
import {
  createDartLanguageAdapter,
  createLanguageRegistry,
  STRUCTURAL_KINDS,
} from '../../src/v2/languages';
import { createAdapterStructuralResolver } from '../../src/v2/structural/resolveStructuralTarget';

const CORE_WASM = path.resolve(__dirname, '../../../../node_modules/web-tree-sitter/tree-sitter.wasm');
const DART_WASM = path.resolve(__dirname, '../../assets/tree-sitter-dart.wasm');
const ASSETS = {
  coreWasmPath: CORE_WASM,
  languageWasmPaths: { dart: DART_WASM },
};

const FLUTTER_LIKE_SOURCE = `// 🚀 Dart source
class MyWidget extends StatelessWidget {
  @override
  Widget build(Object context) {
    if (loading) {
      if (retry) {
        return Widget();
      }
      return Widget();
    }
    return Widget();
  }
}

Widget makeWidget() {
  return Widget();
}
`;

const resolver = createAdapterStructuralResolver(
  createLanguageRegistry([createDartLanguageAdapter(ASSETS)]),
);

describe('Dart language adapter', () => {
  it('registers Dart with the canonical structural capability set', () => {
    const adapter = createDartLanguageAdapter(ASSETS);

    expect(adapter.extensions).toEqual(['.dart']);
    expect(adapter.structural.supportedKinds).toEqual(STRUCTURAL_KINDS);
    expect(adapter.grammarIdForFile('lib/widget.dart')).toBe('dart');
  });

  it('resolves widget classes, annotated methods, and top-level functions', async () => {
    const classMatch = await resolver({
      source: FLUTTER_LIKE_SOURCE,
      filePath: 'lib/widget.dart',
      selector: { path: [{ kind: 'class', name: 'MyWidget' }] },
    });
    expect(FLUTTER_LIKE_SOURCE.slice(classMatch.start, classMatch.end)).toContain('class MyWidget');

    const methodMatch = await resolver({
      source: FLUTTER_LIKE_SOURCE,
      filePath: 'lib/widget.dart',
      selector: {
        path: [
          { kind: 'class', name: 'MyWidget' },
          { kind: 'method', name: 'build' },
        ],
      },
    });
    expect(FLUTTER_LIKE_SOURCE.slice(methodMatch.start, methodMatch.end)).toMatch(
      /@override\s+Widget build[\s\S]*return Widget\(\);\s+}/,
    );

    const functionMatch = await resolver({
      source: FLUTTER_LIKE_SOURCE,
      filePath: 'lib/widget.dart',
      selector: { path: [{ kind: 'function', name: 'makeWidget' }] },
    });
    expect(FLUTTER_LIKE_SOURCE.slice(functionMatch.start, functionMatch.end)).toBe(
      'Widget makeWidget() {\n  return Widget();\n}',
    );
  });

  it('walks nested conditionals within the selected method and preserves UTF-16 offsets', async () => {
    const match = await resolver({
      source: FLUTTER_LIKE_SOURCE,
      filePath: 'lib/widget.dart',
      selector: {
        path: [
          { kind: 'class', name: 'MyWidget' },
          { kind: 'method', name: 'build' },
          { kind: 'if_statement' },
        ],
        startsWith: 'if (retry)',
      },
    });

    const expectedStart = FLUTTER_LIKE_SOURCE.indexOf('if (retry)');
    expect(match.start).toBe(expectedStart);
    expect(FLUTTER_LIKE_SOURCE.slice(match.start, match.end)).toMatch(/^if \(retry\)/);
    expect(match.end).toBeGreaterThan(match.start);
  });

  it('does not treat a Dart method as a top-level function', async () => {
    await expect(resolver({
      source: FLUTTER_LIKE_SOURCE,
      filePath: 'lib/widget.dart',
      selector: { path: [{ kind: 'function', name: 'build' }] },
    })).rejects.toThrow('TARGET_NOT_FOUND');
  });

  it('keeps method bodies behind the method ownership boundary', async () => {
    await expect(resolver({
      source: FLUTTER_LIKE_SOURCE,
      filePath: 'lib/widget.dart',
      selector: {
        path: [
          { kind: 'class', name: 'MyWidget' },
          { kind: 'if_statement' },
        ],
      },
    })).rejects.toThrow('TARGET_NOT_FOUND');
  });

  it('resolves constructors and nested control-flow statements with Dart naming', async () => {
    const source = `// 🚀
class Counter {
  Counter(this.value);
  Counter.named(this.value) {}

  Widget build(Object context) {
    for (var i = 0; i < 1; i++) {
      while (ready) {
        switch (value) {
          case 1:
            return Widget();
          default:
            return Widget();
        }
      }
    }
    return Widget();
  }
}
`;

    const unnamedConstructor = await resolver({
      source,
      filePath: 'counter.dart',
      selector: {
        path: [
          { kind: 'class', name: 'Counter' },
          { kind: 'constructor', name: 'new' },
        ],
      },
    });
    const expectedUnnamedConstructor = 'Counter(this.value);';
    const unnamedConstructorStart = source.indexOf(expectedUnnamedConstructor);
    expect(unnamedConstructor.start).toBe(unnamedConstructorStart);
    expect(unnamedConstructor.end).toBe(
      unnamedConstructorStart + expectedUnnamedConstructor.length,
    );
    expect(source.slice(unnamedConstructor.start, unnamedConstructor.end)).toBe(
      expectedUnnamedConstructor,
    );

    const namedConstructor = await resolver({
      source,
      filePath: 'counter.dart',
      selector: {
        path: [
          { kind: 'class', name: 'Counter' },
          { kind: 'constructor', name: 'named' },
        ],
      },
    });
    const expectedNamedConstructor = 'Counter.named(this.value) {}';
    const namedConstructorStart = source.indexOf(expectedNamedConstructor);
    expect(namedConstructor.start).toBe(namedConstructorStart);
    expect(namedConstructor.end).toBe(
      namedConstructorStart + expectedNamedConstructor.length,
    );
    expect(source.slice(namedConstructor.start, namedConstructor.end)).toBe(
      expectedNamedConstructor,
    );

    const forMatch = await resolver({
      source,
      filePath: 'counter.dart',
      selector: {
        path: [
          { kind: 'class', name: 'Counter' },
          { kind: 'method', name: 'build' },
          { kind: 'for_statement' },
        ],
      },
    });
    expect(source.slice(forMatch.start, forMatch.end)).toMatch(/^for \(/);

    const whileMatch = await resolver({
      source,
      filePath: 'counter.dart',
      selector: {
        path: [
          { kind: 'class', name: 'Counter' },
          { kind: 'method', name: 'build' },
          { kind: 'for_statement' },
          { kind: 'while_statement' },
        ],
      },
    });
    expect(source.slice(whileMatch.start, whileMatch.end)).toMatch(/^while \(/);

    const switchMatch = await resolver({
      source,
      filePath: 'counter.dart',
      selector: {
        path: [
          { kind: 'class', name: 'Counter' },
          { kind: 'method', name: 'build' },
          { kind: 'for_statement' },
          { kind: 'while_statement' },
          { kind: 'switch_statement' },
        ],
      },
      startsWith: 'switch (value)',
    });
    expect(source.slice(switchMatch.start, switchMatch.end)).toMatch(/^switch \(value\)/);
  });

  it('converts custom method and function ranges to UTF-16 after emoji-prefixed source', async () => {
    const source = `// 🚀
class Counter {
  @override
  Widget build(Object context) {
    return Widget();
  }
}

Widget makeWidget() {
  return Widget();
}
`;

    const methodMatch = await resolver({
      source,
      filePath: 'counter.dart',
      selector: {
        path: [
          { kind: 'class', name: 'Counter' },
          { kind: 'method', name: 'build' },
        ],
      },
    });
    const methodStart = source.indexOf('@override');
    const expectedMethod =
      '@override\n  Widget build(Object context) {\n    return Widget();\n  }';
    const methodEnd = methodStart + expectedMethod.length;
    expect(methodMatch.start).toBe(methodStart);
    expect(methodMatch.end).toBe(methodEnd);
    expect(source.slice(methodMatch.start, methodMatch.end)).toBe(expectedMethod);

    const functionMatch = await resolver({
      source,
      filePath: 'counter.dart',
      selector: { path: [{ kind: 'function', name: 'makeWidget' }] },
    });
    const functionStart = source.indexOf('Widget makeWidget');
    const expectedFunction = 'Widget makeWidget() {\n  return Widget();\n}';
    expect(functionMatch.start).toBe(functionStart);
    expect(functionMatch.end).toBe(functionStart + expectedFunction.length);
    expect(source.slice(functionMatch.start, functionMatch.end)).toBe(expectedFunction);
  });

  it('handles annotated abstract classes, factory/const constructors, and Dart loop forms', async () => {
    const source = `// 🚀
@immutable
abstract class Box<T> {
  @named
  factory Box.from(T value) => Box._(value);
  const Box.empty();
  Box._(this.value);

  @override
  Future<void> load() async {}

  Iterable<T> items() sync* {
    yield value;
  }

  void run(List<T> values) {
    for (final value in values) {}
    for (var index = 0; index < 1; index++) {}
  }
}
`;

    const classMatch = await resolver({
      source,
      filePath: 'box.dart',
      selector: { path: [{ kind: 'class', name: 'Box' }] },
    });
    const classSource = source.slice(classMatch.start, classMatch.end);
    expect(classSource).toMatch(/^@immutable\nabstract class Box/);
    expect(classSource).toContain('Box._(this.value);');

    const factoryMatch = await resolver({
      source,
      filePath: 'box.dart',
      selector: {
        path: [
          { kind: 'class', name: 'Box' },
          { kind: 'constructor', name: 'from' },
        ],
      },
    });
    expect(source.slice(factoryMatch.start, factoryMatch.end)).toBe(
      '@named\n  factory Box.from(T value) => Box._(value);',
    );

    const constMatch = await resolver({
      source,
      filePath: 'box.dart',
      selector: {
        path: [
          { kind: 'class', name: 'Box' },
          { kind: 'constructor', name: 'empty' },
        ],
      },
    });
    expect(source.slice(constMatch.start, constMatch.end)).toBe('const Box.empty();');

    const forInMatch = await resolver({
      source,
      filePath: 'box.dart',
      selector: {
        path: [
          { kind: 'class', name: 'Box' },
          { kind: 'method', name: 'run' },
          { kind: 'for_statement' },
        ],
        startsWith: 'for (final value in values)',
      },
    });
    expect(source.slice(forInMatch.start, forInMatch.end)).toBe(
      'for (final value in values) {}',
    );

    const classicForMatch = await resolver({
      source,
      filePath: 'box.dart',
      selector: {
        path: [
          { kind: 'class', name: 'Box' },
          { kind: 'method', name: 'run' },
          { kind: 'for_statement' },
        ],
        startsWith: 'for (var index = 0;',
      },
    });
    expect(source.slice(classicForMatch.start, classicForMatch.end)).toBe(
      'for (var index = 0; index < 1; index++) {}',
    );
  });

  it('keeps Dart local functions and closures behind the method boundary', async () => {
    const source = `class Controller {
  void run(List<int> values) {
    void local() {
      if (localOnly) {}
    }
    values.forEach((value) {
      if (closureOnly) {}
    });
  }
}
`;

    await expect(resolver({
      source,
      filePath: 'controller.dart',
      selector: {
        path: [
          { kind: 'class', name: 'Controller' },
          { kind: 'method', name: 'run' },
          { kind: 'if_statement' },
        ],
      },
    })).rejects.toThrow('TARGET_NOT_FOUND');
  });
});
