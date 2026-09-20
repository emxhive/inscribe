import { describe, expect, it, vi } from 'vitest';
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

describe('V2 language capability boundaries', () => {
  it('does not expose Tree-sitter as an authoritative syntax validator', async () => {
    const typescript = createTypeScriptLanguageAdapter(ASSETS);
    const dart = createDartLanguageAdapter(ASSETS);
    const registry = createV2LanguageRegistry([typescript, dart]);
    const validator = createAdapterSyntaxValidator(registry);

    expect('validateSyntax' in typescript).toBe(false);
    expect('validateSyntax' in dart).toBe(false);

    await expect(validator({
      filePath: 'fixture.ts',
      extension: '.ts',
      source: 'function run() {',
    })).resolves.toBeUndefined();
    await expect(validator({
      filePath: 'fixture.dart',
      extension: '.dart',
      source: 'class App {',
    })).resolves.toBeUndefined();
  });

  it('keeps the shared validation boundary available to real validators', async () => {
    const validateSyntax = vi.fn(async () => {
      throw new Error('AUTHORITATIVE_VALIDATOR_REJECTED');
    });
    const registry = createV2LanguageRegistry([{
      id: 'syntax-only',
      extensions: ['.syntax'],
      validateSyntax,
    }]);
    const validator = createAdapterSyntaxValidator(registry);

    await expect(validator({
      filePath: 'fixture.syntax',
      extension: '.syntax',
      source: 'not valid',
    })).rejects.toThrow('AUTHORITATIVE_VALIDATOR_REJECTED');
    expect(validateSyntax).toHaveBeenCalledTimes(1);
  });

  it('does not make textual or file operations depend on a structural grammar', async () => {
    const registry = createV2LanguageRegistry([createTypeScriptLanguageAdapter(ASSETS)]);
    const syntaxValidator = createAdapterSyntaxValidator(registry);
    const context = { syntaxValidator };

    await expect(resolveOperation({
      strategy: 'create_file',
      filePath: 'new.ts',
      content: 'function run() {',
    }, new Map(), context)).resolves.toBeDefined();

    await expect(resolveOperation({
      strategy: 'replace_file',
      filePath: 'existing.ts',
      content: 'function run() {',
    }, new Map([['existing.ts', { content: 'function run() {}', exists: true }]]), context))
      .resolves.toBeDefined();

    await expect(resolveOperation({
      strategy: 'replace_text',
      filePath: 'existing.ts',
      search: '{}',
      content: '{',
    }, new Map([['existing.ts', { content: 'function run() {}', exists: true }]]), context))
      .resolves.toBeDefined();
  });

  it('keeps structural replacement available without claiming the replacement is syntax-valid', async () => {
    const registry = createV2LanguageRegistry([createTypeScriptLanguageAdapter(ASSETS)]);
    const structuralResolver = createAdapterStructuralResolver(registry);

    await expect(resolveOperation({
      strategy: 'replace_node',
      filePath: 'existing.ts',
      content: 'function run() {',
      selector: { path: [{ kind: 'function', name: 'run' }] },
    }, new Map([['existing.ts', { content: 'function run() {}', exists: true }]]), {
      structuralResolver,
      syntaxValidator: createAdapterSyntaxValidator(registry),
    })).resolves.toBeDefined();
  });

  it('retains parser limitations as structural diagnostics for an affected target', async () => {
    const registry = createV2LanguageRegistry([createDartLanguageAdapter(ASSETS)]);
    const resolver = createAdapterStructuralResolver(registry);
    const source = `String paymentLabel(PaymentState state) => switch (state) {
  PaymentState.pending => 'pending',
  PaymentState.captured => 'captured',
};`;

    await expect(resolver({
      source,
      filePath: 'modern.dart',
      selector: { path: [{ kind: 'function', name: 'paymentLabel' }] },
    })).rejects.toMatchObject({
      code: 'STRUCTURAL_TARGET_UNRELIABLE',
      structuralParser: {
        parser: 'tree-sitter',
        adapterId: 'dart-v2',
        grammarId: 'dart',
      },
    });
  });

  it('allows a trustworthy target beside unrelated recoverable parser damage', async () => {
    const registry = createV2LanguageRegistry([createTypeScriptLanguageAdapter(ASSETS)]);
    const resolver = createAdapterStructuralResolver(registry);
    const source = `function broken() {
  const value = ;
}

function intact() {
  return 1;
}`;

    const match = await resolver({
      source,
      filePath: 'recoverable.ts',
      selector: { path: [{ kind: 'function', name: 'intact' }] },
    });

    expect(source.slice(match.start, match.end)).toContain('function intact()');
  });

  it('applies STARTS_WITH before rejecting an unreliable sibling candidate', async () => {
    const registry = createV2LanguageRegistry([createTypeScriptLanguageAdapter(ASSETS)]);
    const resolver = createAdapterStructuralResolver(registry);
    const source = `function run() {
  const value = ;
}

function run() {
  return 2;
}`;

    const match = await resolver({
      source,
      filePath: 'qualified-recovery.ts',
      selector: {
        path: [{ kind: 'function', name: 'run' }],
        startsWith: 'function run() {\n  return 2',
      },
    });

    expect(source.slice(match.start, match.end)).toContain('return 2;');
    expect(source.slice(match.start, match.end)).not.toContain('const value = ;');
  });

  it('does not silently turn an unreliable ambiguous set into a unique target', async () => {
    const registry = createV2LanguageRegistry([createTypeScriptLanguageAdapter(ASSETS)]);
    const resolver = createAdapterStructuralResolver(registry);
    const source = `function run() {
  const value = ;
}

function run() {
  return 2;
}`;

    await expect(resolver({
      source,
      filePath: 'ambiguous-recovery.ts',
      selector: { path: [{ kind: 'function', name: 'run' }] },
    })).rejects.toMatchObject({
      code: 'STRUCTURAL_TARGET_UNRELIABLE',
      structuralParser: {
        diagnostics: expect.arrayContaining([
          expect.objectContaining({ condition: 'ERROR_NODE' }),
        ]),
      },
    });
  });

  it('bounds structural parser diagnostic context and payload size', async () => {
    const registry = createV2LanguageRegistry([createTypeScriptLanguageAdapter(ASSETS)]);
    const resolver = createAdapterStructuralResolver(registry);
    const source = Array.from(
      { length: 50 },
      (_, index) => `function broken${index}() { const value = ; }`,
    ).join('\n');

    const error = await resolver({
      source,
      filePath: 'many-diagnostics.ts',
      selector: { path: [{ kind: 'function', name: 'missing' }] },
    }).catch((caught) => caught as any);

    expect(error).toMatchObject({ code: 'STRUCTURAL_TARGET_UNRELIABLE' });
    expect(error.structuralParser.totalDiagnostics).toBeGreaterThan(20);
    expect(error.structuralParser.diagnostics).toHaveLength(20);
    expect(error.structuralParser.diagnosticsTruncated).toBe(true);
    expect(error.structuralParser.diagnostics.every((diagnostic: { context: string }) => diagnostic.context.length <= 240)).toBe(true);
  });

  it('taints only the failed file while preserving parser diagnostics', async () => {
    const registry = createV2LanguageRegistry([createTypeScriptLanguageAdapter(ASSETS)]);
    const structuralResolver = createAdapterStructuralResolver(registry);
    const syntaxValidator = createAdapterSyntaxValidator(registry);
    const plan = await resolvePlan([
      {
        strategy: 'replace_node',
        filePath: 'broken.ts',
        content: 'class A {}',
        selector: { path: [{ kind: 'class', name: 'A' }] },
      },
      {
        strategy: 'replace_text',
        filePath: 'broken.ts',
        search: 'class',
        content: 'interface',
      },
      {
        strategy: 'create_file',
        filePath: 'independent.ts',
        content: 'function other() {}',
      },
    ], new Map([
      ['broken.ts', { content: 'class A {', exists: true }],
    ]), { structuralResolver, syntaxValidator });

    expect(plan.errors[0]).toMatchObject({
      stepIndex: 0,
      code: 'STRUCTURAL_TARGET_UNRELIABLE',
      structuralParser: {
        adapterId: 'typescript-v2',
        grammarId: 'typescript',
        diagnostics: expect.arrayContaining([
          expect.objectContaining({ condition: expect.stringMatching(/ERROR_NODE|MISSING_NODE/) }),
        ]),
      },
    });
    expect(plan.exclusions[0]).toMatchObject({
      stepIndex: 1,
      blockedByStepIndex: 0,
    });
    expect(plan.executionStepIndices).toEqual([2]);
  });
});
