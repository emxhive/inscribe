import { describe, expect, it, vi } from 'vitest';
import * as path from 'path';
import Parser from 'web-tree-sitter';
import {
  createV2LanguageRegistry,
  createTypeScriptLanguageAdapter,
  V2LanguageRegistry,
  V2LanguageAdapter,
} from '../../src/v2/languages';
import {
  createAdapterStructuralResolver,
  selectStructuralCandidate,
} from '../../src/v2/structural/resolveStructuralTarget';
import { createTreeSitterLanguageAdapter } from '../../src/v2/languages/treeSitterAdapter';

const CORE_WASM = path.resolve(__dirname, '../../../../node_modules/web-tree-sitter/tree-sitter.wasm');
const TS_WASM = path.resolve(__dirname, '../../../../node_modules/tree-sitter-wasms/out/tree-sitter-typescript.wasm');

function adapter(
  id: string,
  extensions: readonly string[],
  candidates = [{ kind: 'function' as const, name: 'run', start: 2, end: 20 }],
  supportedKinds = ['function' as const],
): V2LanguageAdapter {
  return {
    id,
    extensions,
    supportedKinds,
    resolveCandidates: vi.fn(async (query) => {
      expect(query.path).toEqual([{ kind: 'function', name: 'run' }]);
      return candidates;
    }),
  };
}

describe('V2 language adapter contracts', () => {
  it('registers one TypeScript adapter for both grammar variants', () => {
    const typescriptAdapter = createTypeScriptLanguageAdapter({
      coreWasmPath: CORE_WASM,
      languageWasmPaths: {
        typescript: TS_WASM,
        tsx: path.resolve(__dirname, '../../../../node_modules/tree-sitter-wasms/out/tree-sitter-tsx.wasm'),
      },
    });
    const registry = new V2LanguageRegistry([typescriptAdapter]);

    expect(registry.resolve('component.ts')).toBe(typescriptAdapter);
    expect(registry.resolve('component.tsx')).toBe(typescriptAdapter);
    expect(typescriptAdapter.grammarIdForFile('component.ts')).toBe('typescript');
    expect(typescriptAdapter.grammarIdForFile('component.tsx')).toBe('tsx');
  });

  it('resolves extensions case-insensitively and independently of registration order', () => {
    const first = adapter('first', ['.one']);
    const second = adapter('second', ['.TWO']);
    const registry = createV2LanguageRegistry([second, first]);

    expect(registry.resolve('src/file.ONE')).toBe(first);
    expect(registry.resolve('src/file.two')).toBe(second);
    expect(registry.resolve('src/file.unknown')).toBeUndefined();
  });

  it('rejects duplicate ids, duplicate extensions, and duplicate extensions within an adapter', () => {
    const first = adapter('same', ['.one']);
    expect(() => new V2LanguageRegistry([first, adapter('same', ['.two'])])).toThrow(
      'Duplicate language adapter id',
    );
    expect(() => new V2LanguageRegistry([first, adapter('other', ['.ONE'])])).toThrow(
      'already registered',
    );
    expect(() => new V2LanguageRegistry([adapter('invalid', ['.one', '.ONE'])])).toThrow(
      'Duplicate extension',
    );
    expect(() => new V2LanguageRegistry([adapter('no-kinds', ['.none'], [], [])])).toThrow(
      'supportedKinds are required',
    );
    expect(() => new V2LanguageRegistry([adapter(
      'duplicate-kinds',
      ['.duplicate'],
      [],
      ['function', 'function'],
    )])).toThrow('supportedKinds are invalid');
  });

  it('keeps STARTS_WITH, not-found, ambiguity, and winner selection in the core', () => {
    const source = '  function run() {}\n  function run() { return 1; }';
    const firstStart = source.indexOf('function');
    const secondStart = source.indexOf('function', firstStart + 1);
    const candidates = [
      {
        kind: 'function' as const,
        name: 'run',
        start: firstStart,
        end: firstStart + 'function run() {}'.length,
      },
      { kind: 'function' as const, name: 'run', start: secondStart, end: source.length },
    ];

    expect(() => selectStructuralCandidate(source, {
      path: [{ kind: 'function', name: 'run' }],
    }, candidates)).toThrow('TARGET_AMBIGUOUS');

    const selected = selectStructuralCandidate(source, {
      path: [{ kind: 'function', name: 'run' }],
      startsWith: 'function run() { return',
    }, candidates);
    expect(source.slice(selected.start, selected.end)).toBe('function run() { return 1; }');

    expect(() => selectStructuralCandidate(source, {
      path: [{ kind: 'function', name: 'run' }],
      startsWith: 'function missing',
    }, candidates)).toThrow('TARGET_QUALIFIER_NOT_MATCHED');

    expect(() => selectStructuralCandidate(source, {
      path: [{ kind: 'function', name: 'missing' }],
    }, [])).toThrow('TARGET_NOT_FOUND');
  });

  it('exposes only logical UTF-16 ranges through the adapter-backed resolver', async () => {
    const source = '// 🚀\nfunction run() {}';
    const candidate = {
      kind: 'function' as const,
      name: 'run',
      start: source.indexOf('function'),
      end: source.length,
    };
    const resolveCandidates = vi.fn(async () => [candidate]);
    const registry = new V2LanguageRegistry([{
      id: 'test-language',
      extensions: ['.test'],
      supportedKinds: ['function'],
      resolveCandidates,
    }]);
    const resolver = createAdapterStructuralResolver(registry);

    const match = await resolver({
      source,
      filePath: 'fixture.TEST',
      selector: { path: [{ kind: 'function', name: 'run' }] },
    });

    expect(match).toEqual(candidate);
    expect(resolveCandidates).toHaveBeenCalledWith({
      source,
      filePath: 'fixture.TEST',
      extension: '.test',
      path: [{ kind: 'function', name: 'run' }],
    });
  });

  it('rejects a kind the resolved adapter does not support before discovery', async () => {
    const resolveCandidates = vi.fn(async () => []);
    const registry = new V2LanguageRegistry([{
      id: 'function-only',
      extensions: ['.kind'],
      supportedKinds: ['function'],
      resolveCandidates,
    }]);
    const resolver = createAdapterStructuralResolver(registry);

    await expect(resolver({
      source: 'class Example {}',
      filePath: 'Example.kind',
      selector: { path: [{ kind: 'class', name: 'Example' }] },
    })).rejects.toThrow('UNSUPPORTED_STRUCTURAL_KIND');
    expect(resolveCandidates).not.toHaveBeenCalled();
  });

  it('rejects empty candidate ranges at the core boundary', () => {
    expect(() => selectStructuralCandidate('function run() {}', {
      path: [{ kind: 'function', name: 'run' }],
    }, [{ kind: 'function', name: 'run', start: 5, end: 5 }])).toThrow(
      'INVALID_STRUCTURAL_CANDIDATE',
    );
  });

  it('rejects a candidate whose kind does not match the selector leaf kind', () => {
    expect(() => selectStructuralCandidate('class Example {}', {
      path: [{ kind: 'function', name: 'Example' }],
    }, [{ kind: 'class', name: 'Example', start: 0, end: 16 }])).toThrow(
      'STRUCTURAL_CANDIDATE_KIND_MISMATCH',
    );
  });

  it('converts Tree-sitter nodes to UTF-16 candidates before crossing the adapter boundary', async () => {
    const source = '// 🚀\nfunction run() {}';
    const grammarIdForFile = vi.fn((filePath: string) =>
      filePath.endsWith('.tsx') ? 'tsx' : 'typescript',
    );
    const adapter = createTreeSitterLanguageAdapter({
      id: 'tree-sitter-test',
      extensions: ['.ts', '.tsx'],
      supportedKinds: ['function'],
      grammarIdForFile,
      collectCandidates(rootNode: Parser.SyntaxNode) {
        const visit = (node: Parser.SyntaxNode): Parser.SyntaxNode | undefined => {
          if (node.type === 'function_declaration') {
            return node;
          }
          for (let index = 0; index < node.namedChildCount; index++) {
            const child = node.namedChild(index);
            if (child) {
              const match = visit(child);
              if (match) return match;
            }
          }
          return undefined;
        };

        const node = visit(rootNode);
        return node ? [{ kind: 'function' as const, name: 'run', replacementNode: node }] : [];
      },
    }, {
      coreWasmPath: CORE_WASM,
      languageWasmPaths: {
        typescript: TS_WASM,
        tsx: path.resolve(__dirname, '../../../../node_modules/tree-sitter-wasms/out/tree-sitter-tsx.wasm'),
      },
    });

    const candidates = await adapter.resolveCandidates({
      source,
      filePath: 'fixture.tsx',
      extension: '.tsx',
      path: [{ kind: 'function', name: 'run' }],
    });

    expect(candidates).toEqual([{
      kind: 'function',
      name: 'run',
      start: source.indexOf('function'),
      end: source.length,
    }]);
    expect('replacementNode' in candidates[0]).toBe(false);
    expect(grammarIdForFile).toHaveBeenCalledWith('fixture.tsx');

    await adapter.resolveCandidates({
      source,
      filePath: 'fixture.ts',
      extension: '.ts',
      path: [{ kind: 'function', name: 'run' }],
    });
    expect(grammarIdForFile).toHaveBeenCalledWith('fixture.ts');
  });
});
