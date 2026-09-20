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

  it('keeps a clean statement editable beside an unrelated broken initializer', async () => {
    const registry = createV2LanguageRegistry([createTypeScriptLanguageAdapter(ASSETS)]);
    const resolver = createAdapterStructuralResolver(registry);
    const source = `function run() {
  if (a) {
    doA();
  }

  const broken = ;
}`;

    const match = await resolver({
      source,
      filePath: 'incomplete-search-scope.ts',
      selector: {
        path: [
          { kind: 'function', name: 'run' },
          { kind: 'if_statement' },
        ],
      },
    });

    expect(source.slice(match.start, match.end)).toContain('doA();');
  });

  it('replaces a complete function whose body contains broken syntax', async () => {
    const registry = createV2LanguageRegistry([createTypeScriptLanguageAdapter(ASSETS)]);
    const structuralResolver = createAdapterStructuralResolver(registry);
    const source = `function run() {
  const value = ;
}`;

    const execution = await resolveOperation({
      strategy: 'replace_node',
      filePath: 'broken-function.ts',
      content: 'function run() { return 2; }',
      selector: { path: [{ kind: 'function', name: 'run' }] },
    }, new Map([['broken-function.ts', { content: source, exists: true }]]), {
      structuralResolver,
    });

    expect(execution.afterContent).toBe('function run() { return 2; }');
  });

  it('keeps a clean loop editable beside a broken sibling expression', async () => {
    const registry = createV2LanguageRegistry([createTypeScriptLanguageAdapter(ASSETS)]);
    const resolver = createAdapterStructuralResolver(registry);
    const source = `function run() {
  for (const item of items) {
    visit(item);
  }

  const broken = ;
}`;

    const match = await resolver({
      source,
      filePath: 'loop-with-recovery.ts',
      selector: {
        path: [
          { kind: 'function', name: 'run' },
          { kind: 'for_statement' },
        ],
      },
    });

    expect(source.slice(match.start, match.end)).toContain('visit(item);');
  });

  it('keeps declaration identity trustworthy when recovery is confined to parameters', async () => {
    const registry = createV2LanguageRegistry([createTypeScriptLanguageAdapter(ASSETS)]);
    const resolver = createAdapterStructuralResolver(registry);
    const source = `function run(value = ) {
  return 1;
}`;

    const match = await resolver({
      source,
      filePath: 'parameter-recovery.ts',
      selector: { path: [{ kind: 'function', name: 'run' }] },
    });

    expect(source.slice(match.start, match.end)).toContain('function run');
  });

  it('fails closed when recovery reaches a candidate boundary that can hide structure', async () => {
    const registry = createV2LanguageRegistry([createTypeScriptLanguageAdapter(ASSETS)]);
    const resolver = createAdapterStructuralResolver(registry);
    const source = `function run() {
  if (ready) {
    work();
  }

  if (other)
}`;

    await expect(resolver({
      source,
      filePath: 'candidate-boundary-recovery.ts',
      selector: {
        path: [
          { kind: 'function', name: 'run' },
          { kind: 'if_statement' },
        ],
      },
    })).rejects.toMatchObject({ code: 'STRUCTURAL_TARGET_UNRELIABLE' });
  });

  it('does not discard a named candidate when recovery damages its identity', async () => {
    const registry = createV2LanguageRegistry([createTypeScriptLanguageAdapter(ASSETS)]);
    const resolver = createAdapterStructuralResolver(registry);
    const source = `function ?other() {
  return 1;
}

function run() {
  return 2;
}`;

    await expect(resolver({
      source,
      filePath: 'identity-recovery.ts',
      selector: { path: [{ kind: 'function', name: 'run' }] },
    })).rejects.toMatchObject({ code: 'STRUCTURAL_TARGET_UNRELIABLE' });
  });

  it('ignores recovery inside a nested owner that the traversal deliberately skips', async () => {
    const registry = createV2LanguageRegistry([createTypeScriptLanguageAdapter(ASSETS)]);
    const resolver = createAdapterStructuralResolver(registry);
    const source = `function run() {
  function nested() {
    const broken = ;
  }

  if (ready) {
    work();
  }
}`;

    const match = await resolver({
      source,
      filePath: 'skipped-owner-recovery.ts',
      selector: {
        path: [
          { kind: 'function', name: 'run' },
          { kind: 'if_statement' },
        ],
      },
    });

    expect(source.slice(match.start, match.end)).toContain('work();');
  });

  it('ignores interior recovery contained by a known candidate for sibling discovery', async () => {
    const registry = createV2LanguageRegistry([createTypeScriptLanguageAdapter(ASSETS)]);
    const resolver = createAdapterStructuralResolver(registry);
    const source = `function run() {
  if (a) {
    const value = ;
  }

  if (b) {
    return 2;
  }
}`;

    const match = await resolver({
      source,
      filePath: 'contained-recovery.ts',
      selector: {
        path: [
          { kind: 'function', name: 'run' },
          { kind: 'if_statement' },
        ],
        startsWith: 'if (b)',
      },
    });

    expect(source.slice(match.start, match.end)).toContain('return 2;');
  });

  it('does not let recovery in another structural owner poison the requested owner', async () => {
    const registry = createV2LanguageRegistry([createTypeScriptLanguageAdapter(ASSETS)]);
    const resolver = createAdapterStructuralResolver(registry);
    const source = `function broken() {
  if (a) {
    const value = ;
  }
}

function run() {
  if (b) {
    return 1;
  }
}`;

    const match = await resolver({
      source,
      filePath: 'other-owner-recovery.ts',
      selector: {
        path: [
          { kind: 'function', name: 'run' },
          { kind: 'if_statement' },
        ],
      },
    });

    expect(source.slice(match.start, match.end)).toContain('return 1;');
  });

  it('allows trustworthy target absence when unrelated owner recovery is contained', async () => {
    const registry = createV2LanguageRegistry([createTypeScriptLanguageAdapter(ASSETS)]);
    const resolver = createAdapterStructuralResolver(registry);

    await expect(resolver({
      source: `function broken() {
  const value = ;
}

function healthy() {}`,
      filePath: 'unrelated-absence.ts',
      selector: { path: [{ kind: 'function', name: 'missing' }] },
    })).rejects.toThrow('TARGET_NOT_FOUND');
  });

  it('keeps target absence uncertain when recovery is in the actual search space', async () => {
    const registry = createV2LanguageRegistry([createTypeScriptLanguageAdapter(ASSETS)]);
    const resolver = createAdapterStructuralResolver(registry);

    await expect(resolver({
      source: 'function (',
      filePath: 'uncertain-absence.ts',
      selector: { path: [{ kind: 'function', name: 'missing' }] },
    })).rejects.toMatchObject({ code: 'STRUCTURAL_TARGET_UNRELIABLE' });
  });

  it('fails closed when recovery can hide another candidate of the requested kind', async () => {
    const registry = createV2LanguageRegistry([createTypeScriptLanguageAdapter(ASSETS)]);
    const resolver = createAdapterStructuralResolver(registry);

    await expect(resolver({
      source: `function (

function run() { return 2; }`,
      filePath: 'hidden-function-recovery.ts',
      selector: { path: [{ kind: 'function', name: 'run' }] },
    })).rejects.toMatchObject({ code: 'STRUCTURAL_TARGET_UNRELIABLE' });
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

  it('keeps interior parser damage out of structural trust when outer boundaries are clear', async () => {
    const adapter = createTypeScriptLanguageAdapter(ASSETS);
    const source = `function run() {
  const value = ;
}

function run() {
  return 2;
}`;
    const discovery = await adapter.structural.resolveCandidates({
      source,
      filePath: 'qualified-recovery.ts',
      extension: '.ts',
      path: [{ kind: 'function', name: 'run' }],
    });
    const candidates = Array.isArray(discovery) ? discovery : discovery.candidates;

    expect(candidates[0].reliability).toBeUndefined();
    expect(candidates[1].reliability).toBeUndefined();
  });

  it('does not convert a recovery-uncertain qualifier boundary into a mismatch', async () => {
    const adapter = createTypeScriptLanguageAdapter(ASSETS);
    const source = `function run() {
  return 1;`;
    const discovery = await adapter.structural.resolveCandidates({
      source,
      filePath: 'boundary-recovery.ts',
      extension: '.ts',
      path: [{ kind: 'function', name: 'run' }],
    });
    const candidates = Array.isArray(discovery) ? discovery : discovery.candidates;
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      reliability: {
        qualification: 'uncertain',
      },
    });

    const registry = createV2LanguageRegistry([adapter]);
    const resolver = createAdapterStructuralResolver(registry);

    await expect(resolver({
      source,
      filePath: 'boundary-recovery.ts',
      selector: {
        path: [{ kind: 'function', name: 'run' }],
        startsWith: 'function missing',
      },
    })).rejects.toMatchObject({ code: 'STRUCTURAL_TARGET_UNRELIABLE' });

    await expect(resolver({
      source,
      filePath: 'boundary-recovery.ts',
      selector: { path: [{ kind: 'function', name: 'run' }] },
    })).rejects.toMatchObject({ code: 'STRUCTURAL_TARGET_UNRELIABLE' });
  });

  it('preserves ambiguity when parser damage does not make candidate qualification uncertain', async () => {
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
    })).rejects.toThrow('TARGET_AMBIGUOUS');
  });

  it('bounds structural parser diagnostic context and payload size', async () => {
    const registry = createV2LanguageRegistry([createTypeScriptLanguageAdapter(ASSETS)]);
    const resolver = createAdapterStructuralResolver(registry);
    const source = Array.from(
      { length: 50 },
      (_, index) => `function ?broken${index}() {}`,
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
