import { describe, expect, it } from 'vitest';
import * as path from 'path';
import {
  createAdapterSyntaxValidator,
  createDartLanguageAdapter,
  createTypeScriptLanguageAdapter,
  createV2LanguageRegistry,
} from '../../src/v2/languages';
import { resolveOperation } from '../../src/v2/execution/resolveOperation';
import { resolvePlan } from '../../src/v2/execution/resolvePlan';
import { createAdapterStructuralResolver } from '../../src/v2/structural/resolveStructuralTarget';

const CORE_WASM = path.resolve(__dirname, '../../../../node_modules/web-tree-sitter/tree-sitter.wasm');
const TS_WASM = path.resolve(__dirname, '../../../../node_modules/tree-sitter-wasms/out/tree-sitter-typescript.wasm');
const TSX_WASM = path.resolve(__dirname, '../../../../node_modules/tree-sitter-wasms/out/tree-sitter-tsx.wasm');
const DART_WASM = path.resolve(__dirname, '../../assets/tree-sitter-dart.wasm');

const ASSETS = {
  coreWasmPath: CORE_WASM,
  languageWasmPaths: {
    typescript: TS_WASM,
    tsx: TSX_WASM,
    dart: DART_WASM,
  },
};

const validator = createAdapterSyntaxValidator(
  createV2LanguageRegistry([
    createTypeScriptLanguageAdapter(ASSETS),
    createDartLanguageAdapter(ASSETS),
  ]),
);
const registry = createV2LanguageRegistry([
  createTypeScriptLanguageAdapter(ASSETS),
]);
const structuralResolver = createAdapterStructuralResolver(registry);
const executionContext = { structuralResolver, syntaxValidator: createAdapterSyntaxValidator(registry) };

describe('V2 language syntax validation', () => {
  it('validates TypeScript, TSX, and Dart using their registered grammars', async () => {
    await validator({
      filePath: 'fixture.ts',
      extension: '.ts',
      source: 'function run(): number { return 1; }',
    });
    await validator({
      filePath: 'fixture.tsx',
      extension: '.tsx',
      source: 'function App() { return <div />; }',
    });
    await validator({
      filePath: 'fixture.dart',
      extension: '.dart',
      source: 'class App { Widget build() { return Widget(); } }',
    });
  });

  it('rejects syntax errors in each supported language', async () => {
    await expect(validator({
      filePath: 'fixture.ts',
      extension: '.ts',
      source: 'function run() {',
    })).rejects.toThrow('PARSER_DIAGNOSTICS_PRESENT');
    await expect(validator({
      filePath: 'fixture.tsx',
      extension: '.tsx',
      source: 'function App() { return <div>; }',
    })).rejects.toThrow('PARSER_DIAGNOSTICS_PRESENT');
    await expect(validator({
      filePath: 'fixture.dart',
      extension: '.dart',
      source: 'class App { Widget build() { return Widget(); }',
    })).rejects.toThrow('PARSER_DIAGNOSTICS_PRESENT');
  });

  it('preserves current behavior for unsupported file types', async () => {
    await expect(validator({
      filePath: 'fixture.json',
      extension: '.json',
      source: '{ invalid json',
    })).resolves.toBeUndefined();
  });

  it('validates the resulting content at the shared operation boundary', async () => {
    const validSource = 'function run() { return 1; }';

    await expect(resolveOperation({
      strategy: 'create_file',
      filePath: 'new.ts',
      content: 'function run() {',
    }, new Map(), executionContext)).rejects.toThrow('PARSER_DIAGNOSTICS_PRESENT');

    await expect(resolveOperation({
      strategy: 'replace_file',
      filePath: 'existing.ts',
      content: 'function run() {',
    }, new Map([['existing.ts', { content: validSource, exists: true }]]), executionContext))
      .rejects.toThrow('PARSER_DIAGNOSTICS_PRESENT');

    await expect(resolveOperation({
      strategy: 'replace_text',
      filePath: 'existing.ts',
      search: '}',
      content: '',
    }, new Map([['existing.ts', { content: validSource, exists: true }]]), executionContext))
      .rejects.toThrow('PARSER_DIAGNOSTICS_PRESENT');

    await expect(resolveOperation({
      strategy: 'replace_node',
      filePath: 'existing.ts',
      content: 'function run() {',
      selector: { path: [{ kind: 'function', name: 'run' }] },
    }, new Map([['existing.ts', { content: validSource, exists: true }]]), executionContext))
      .rejects.toThrow('PARSER_DIAGNOSTICS_PRESENT');
  });

  it('taints only the failed file and excludes later same-file work', async () => {
    const plan = await resolvePlan([
      {
        strategy: 'replace_node',
        filePath: 'existing.ts',
        content: 'function run() {',
        selector: { path: [{ kind: 'function', name: 'run' }] },
      },
      {
        strategy: 'replace_node',
        filePath: 'existing.ts',
        content: 'function run() { return 2; }',
        selector: { path: [{ kind: 'function', name: 'run' }] },
      },
      {
        strategy: 'create_file',
        filePath: 'independent.ts',
        content: 'function other() { return 3; }',
      },
    ], new Map([
      ['existing.ts', { content: 'function run() { return 1; }', exists: true }],
    ]), executionContext);

    expect(plan.errors).toEqual([
      expect.objectContaining({
        stepIndex: 0,
        filePath: 'existing.ts',
        message: 'PARSER_DIAGNOSTICS_PRESENT',
      }),
    ]);
    expect(plan.exclusions).toEqual([
      expect.objectContaining({
        stepIndex: 1,
        blockedByStepIndex: 0,
        filePath: 'existing.ts',
      }),
    ]);
    expect(plan.executionStepIndices).toEqual([2]);
    expect(plan.executions[0].filePath).toBe('independent.ts');
  });
});
