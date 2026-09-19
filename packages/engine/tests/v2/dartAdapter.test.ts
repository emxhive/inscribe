import { describe, expect, it } from 'vitest';
import * as path from 'path';
import {
  createDartLanguageAdapter,
  createV2LanguageRegistry,
  V2_STRUCTURAL_KINDS,
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
  createV2LanguageRegistry([createDartLanguageAdapter(ASSETS)]),
);

describe('Dart V2 language adapter', () => {
  it('registers Dart with the canonical V2 structural capability set', () => {
    const adapter = createDartLanguageAdapter(ASSETS);

    expect(adapter.extensions).toEqual(['.dart']);
    expect(adapter.supportedKinds).toEqual(V2_STRUCTURAL_KINDS);
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
});
