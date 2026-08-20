import { describe, it, expect, beforeAll } from 'vitest';
import * as path from 'path';
import { resolvePlan } from '../../src/v2/execution/resolvePlan';
import { createStructuralResolver } from '../../src/v2/structural/resolveStructuralTarget';
import { initTreeSitter } from '../../src/v2/structural/treeSitterRuntime';

const CORE_WASM = path.resolve(__dirname, '../../../../node_modules/web-tree-sitter/tree-sitter.wasm');
const TS_WASM = path.resolve(__dirname, '../../../../node_modules/tree-sitter-wasms/out/tree-sitter-typescript.wasm');
const TSX_WASM = path.resolve(__dirname, '../../../../node_modules/tree-sitter-wasms/out/tree-sitter-tsx.wasm');

const ASSETS = {
  coreWasmPath: CORE_WASM,
  typescriptWasmPath: TS_WASM,
  tsxWasmPath: TSX_WASM,
};

const structuralResolver = createStructuralResolver(ASSETS);

const CONTEXT = {
  structuralResolver
};

beforeAll(async () => {
  await initTreeSitter(ASSETS);
});

describe('V2 virtual structural sequential execution', () => {
  it('handles replace_node -> replace_node sequentially', async () => {
    const source = `class Greeter {\n  greet() {\n    return "1";\n  }\n  wave() {\n    return "2";\n  }\n}`;
    const initialFiles = new Map([['test.ts', { content: source, exists: true }]]);

    const payloads = [
      {
        strategy: 'replace_node' as const,
        filePath: 'test.ts',
        content: '  greet() {\n    return "hello";\n  }',
        selector: {
          path: [
            { kind: 'class' as const, name: 'Greeter' },
            { kind: 'method' as const, name: 'greet' }
          ]
        }
      },
      {
        strategy: 'replace_node' as const,
        filePath: 'test.ts',
        content: '  wave() {\n    return "hi";\n  }',
        selector: {
          path: [
            { kind: 'class' as const, name: 'Greeter' },
            { kind: 'method' as const, name: 'wave' }
          ]
        }
      }
    ];

    const plan = await resolvePlan(payloads, initialFiles, CONTEXT);
    expect(plan.errors.length).toBe(0);
    expect(plan.executions.length).toBe(2);

    expect(plan.executions[0].afterContent).toContain('return "hello";');
    expect(plan.executions[0].afterContent).toContain('return "2";');

    expect(plan.executions[1].afterContent).toContain('return "hello";');
    expect(plan.executions[1].afterContent).toContain('return "hi";');
  });

  it('handles replace_text -> replace_node sequentially', async () => {
    const source = `class Greeter {\n  greet() {\n    return "1";\n  }\n}`;
    const initialFiles = new Map([['test.ts', { content: source, exists: true }]]);

    const payloads = [
      {
        strategy: 'replace_text' as const,
        filePath: 'test.ts',
        search: '"1"',
        content: '"hello"'
      },
      {
        strategy: 'replace_node' as const,
        filePath: 'test.ts',
        content: '  greet() {\n    return "hi";\n  }',
        selector: {
          path: [
            { kind: 'class' as const, name: 'Greeter' },
            { kind: 'method' as const, name: 'greet' }
          ]
        }
      }
    ];

    const plan = await resolvePlan(payloads, initialFiles, CONTEXT);
    expect(plan.errors.length).toBe(0);
    expect(plan.executions.length).toBe(2);

    expect(plan.executions[0].afterContent).toContain('return "hello";');
    expect(plan.executions[1].afterContent).toContain('return "hi";');
  });

  it('handles replace_node -> replace_text sequentially', async () => {
    const source = `class Greeter {\n  greet() {\n    return "1";\n  }\n}`;
    const initialFiles = new Map([['test.ts', { content: source, exists: true }]]);

    const payloads = [
      {
        strategy: 'replace_node' as const,
        filePath: 'test.ts',
        content: '  greet() {\n    return "hello";\n  }',
        selector: {
          path: [
            { kind: 'class' as const, name: 'Greeter' },
            { kind: 'method' as const, name: 'greet' }
          ]
        }
      },
      {
        strategy: 'replace_text' as const,
        filePath: 'test.ts',
        search: '"hello"',
        content: '"hi"'
      }
    ];

    const plan = await resolvePlan(payloads, initialFiles, CONTEXT);
    expect(plan.errors.length).toBe(0);
    expect(plan.executions.length).toBe(2);

    expect(plan.executions[0].afterContent).toContain('return "hello";');
    expect(plan.executions[1].afterContent).toContain('return "hi";');
  });
});
