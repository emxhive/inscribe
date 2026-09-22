import { beforeAll, describe, expect, it } from 'vitest';
import * as path from 'path';
import { resolveOperation } from '../../src/core/execution/resolveOperation';
import { resolvePlan } from '../../src/core/execution/resolvePlan';
import { createAdapterStructuralResolver, parseSelector } from '../../src/core/structural';
import { createLanguageRegistry, createTypeScriptLanguageAdapter } from '../../src/core/languages';
import { initTreeSitter } from '../../src/core/structural/treeSitterRuntime';

const ASSETS = {
  coreWasmPath: path.resolve(__dirname, '../../../../node_modules/web-tree-sitter/tree-sitter.wasm'),
  languageWasmPaths: {
    typescript: path.resolve(__dirname, '../../../../node_modules/tree-sitter-wasms/out/tree-sitter-typescript.wasm'),
    tsx: path.resolve(__dirname, '../../../../node_modules/tree-sitter-wasms/out/tree-sitter-tsx.wasm'),
  },
};

const structuralResolver = createAdapterStructuralResolver(
  createLanguageRegistry([createTypeScriptLanguageAdapter(ASSETS)]),
);

beforeAll(async () => {
  await initTreeSitter(ASSETS);
});

function scopedOperation(selector: string, search: string, content: string) {
  return {
    strategy: 'replace_text' as const,
    filePath: 'test.ts',
    selector: parseSelector(selector),
    search,
    content,
  };
}

describe('scoped replace_text execution', () => {
  it('replaces only the selected structural node when search repeats elsewhere', async () => {
    const source = `class First {
  run() {
    return "same";
  }
}

class Second {
  run() {
    return "same";
  }
}`;
    const targetStart = source.indexOf('class Second');
    const innerStart = source.indexOf('return "same";', targetStart);
    const operation = scopedOperation('class:Second > method:run', 'return "same";', 'return "changed";');

    const execution = await resolveOperation(
      operation,
      new Map([['test.ts', { content: source, exists: true }]]),
      { structuralResolver },
    );

    expect(execution.afterContent).toContain('class First {\n  run() {\n    return "same";');
    expect(execution.afterContent).toContain('class Second {\n  run() {\n    return "changed";');
    expect(execution.targetScope.selector).toEqual(operation.selector);
    expect(execution.targetScope.beforeRange).toEqual({ start: innerStart, end: innerStart + 'return "same";'.length });
    expect(execution.targetScope.afterRange).toEqual({ start: innerStart, end: innerStart + 'return "changed";'.length });
    expect(execution.targetScope.matchMetadata?.resolvedRange).toEqual(execution.targetScope.beforeRange);
  });

  it('keeps duplicate matches inside the selected node ambiguous', async () => {
    const source = `function run() {
  return "same";
  return "same";
}`;
    const operation = scopedOperation('function:run', 'return "same";', 'return "changed";');

    await expect(resolveOperation(
      operation,
      new Map([['test.ts', { content: source, exists: true }]]),
      { structuralResolver },
    )).rejects.toThrow('MUTABLE_TARGET_AMBIGUOUS');
  });

  it('does not find a search that exists outside the selected node', async () => {
    const source = `function first() {
  return "target";
}

function second() {
  return "other";
}`;
    const operation = scopedOperation('function:second', 'return "target";', 'return "changed";');

    await expect(resolveOperation(
      operation,
      new Map([['test.ts', { content: source, exists: true }]]),
      { structuralResolver },
    )).rejects.toThrow('TARGET_NOT_FOUND');
  });

  it('confines fallback matching and translates its metadata to absolute ranges', async () => {
    const source = `function first() { const one = "1"; const two = "2"; }
function second() { const one = "1"; const two = "2"; }`;
    const targetStart = source.indexOf('function second');
    const matchStart = source.indexOf('const one', targetStart);
    const search = `const one = '1'; const two = '2';`;
    const operation = scopedOperation('function:second', search, 'const one = 10; const two = 20;');

    const execution = await resolveOperation(
      operation,
      new Map([['test.ts', { content: source, exists: true }]]),
      { structuralResolver },
    );

    expect(execution.targetScope.matchMetadata?.kind).toBe('fallback');
    expect(execution.targetScope.beforeRange?.start).toBe(matchStart);
    expect(execution.targetScope.matchMetadata?.resolvedRange).toEqual(execution.targetScope.beforeRange);
    expect(execution.afterContent).toContain('function first() { const one = "1"; const two = "2"; }');
    expect(execution.afterContent).toContain('function second() { const one = 10; const two = 20; }');
  });

  it('preserves unscoped replace_text behavior', async () => {
    const source = 'const value = 1;\nconst value = 1;';
    const operation = {
      strategy: 'replace_text' as const,
      filePath: 'test.ts',
      search: 'const value = 1;',
      content: 'const value = 2;',
    };

    await expect(resolveOperation(operation, new Map([['test.ts', { content: source, exists: true }]])))
      .rejects.toThrow('MUTABLE_TARGET_AMBIGUOUS');
  });

  it('uses STARTS_WITH to choose the structural scope', async () => {
    const source = `function run() {
  if (ready) {
    return 1;
  }
  if (other) {
    return 2;
  }
}`;
    const operation = {
      ...scopedOperation('function:run > if_statement', 'return 2;', 'return 20;'),
      selector: parseSelector('function:run > if_statement', 'if (other) {'),
    };

    const execution = await resolveOperation(
      operation,
      new Map([['test.ts', { content: source, exists: true }]]),
      { structuralResolver },
    );

    expect(execution.afterContent).toContain('if (ready) {\n    return 1;');
    expect(execution.afterContent).toContain('if (other) {\n    return 20;');
  });

  it('reports selector ambiguity, unsupported extension, and unsupported kind', async () => {
    const ambiguous = scopedOperation('function:run', 'return 1;', 'return 2;');
    const ambiguousSource = 'function run() { return 1; }\nfunction run() { return 1; }';
    await expect(resolveOperation(
      ambiguous,
      new Map([['test.ts', { content: ambiguousSource, exists: true }]]),
      { structuralResolver },
    )).rejects.toThrow('TARGET_AMBIGUOUS');

    const unsupportedExtension = { ...ambiguous, filePath: 'test.java' };
    await expect(resolveOperation(
      unsupportedExtension,
      new Map([['test.java', { content: 'class A {}', exists: true }]]),
      { structuralResolver },
    )).rejects.toThrow('UNSUPPORTED_EXTENSION');

    const unsupportedKind = {
      ...scopedOperation('class:A > widget:Child', 'return 1;', 'return 2;'),
    };
    await expect(resolveOperation(
      unsupportedKind,
      new Map([['test.ts', { content: 'class A { child() { return 1; } }', exists: true }]]),
      { structuralResolver },
    )).rejects.toThrow('UNSUPPORTED_STRUCTURAL_KIND');
  });

  it('resolves scoped operations against the current virtual state sequentially', async () => {
    const source = 'function run() { return "old"; }';
    const operations = [
      {
        strategy: 'replace_text' as const,
        filePath: 'test.ts',
        search: '"old"',
        content: '"new"',
      },
      scopedOperation('function:run', '"new"', '"final"'),
    ];

    const plan = await resolvePlan(
      operations,
      new Map([['test.ts', { content: source, exists: true }]]),
      { structuralResolver },
    );

    expect(plan.errors).toHaveLength(0);
    expect(plan.executions).toHaveLength(2);
    expect(plan.executions[1].afterContent).toBe('function run() { return "final"; }');
  });
});
