import { describe, it, expect, beforeAll, vi } from 'vitest';
import * as path from 'path';
import Parser from 'web-tree-sitter';
import { resolveOperation, V2ExecutionContext } from '../../src/v2/execution/resolveOperation';
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

const CONTEXT: V2ExecutionContext = {
  structuralResolver,
};

beforeAll(async () => {
  await initTreeSitter(ASSETS);
});

describe('V2 replace_node operation', () => {
  it('replaces a named TypeScript class method', async () => {
    const source = `class Greeter {\n  greet() {\n    return "hello";\n  }\n}`;
    const virtualState = new Map([['test.ts', { content: source, exists: true }]]);
    const op = {
      strategy: 'replace_node' as const,
      filePath: 'test.ts',
      content: 'greet() {\n    return "hi";\n  }',
      selector: {
        path: [
          { kind: 'class' as const, name: 'Greeter' },
          { kind: 'method' as const, name: 'greet' }
        ]
      }
    };

    const exec = await resolveOperation(op, virtualState, CONTEXT);
    expect(exec.afterContent).toBe(`class Greeter {\n  greet() {\n    return "hi";\n  }\n}`);
    expect(exec.targetScope.beforeRange).toBeDefined();

    const slice = source.slice(exec.targetScope.beforeRange!.start, exec.targetScope.beforeRange!.end);
    expect(slice).toBe('greet() {\n    return "hello";\n  }');
  });

  it('replaces a named TypeScript function', async () => {
    const source = `function welcome() {\n  return "welcome";\n}`;
    const virtualState = new Map([['test.ts', { content: source, exists: true }]]);
    const op = {
      strategy: 'replace_node' as const,
      filePath: 'test.ts',
      content: 'function welcome() {\n  return "hey";\n}',
      selector: {
        path: [{ kind: 'function' as const, name: 'welcome' }]
      }
    };

    const exec = await resolveOperation(op, virtualState, CONTEXT);
    expect(exec.afterContent).toBe(`function welcome() {\n  return "hey";\n}`);
    const slice = source.slice(exec.targetScope.beforeRange!.start, exec.targetScope.beforeRange!.end);
    expect(slice).toBe('function welcome() {\n  return "welcome";\n}');
  });

  it('replaces an exported named TSX function component', async () => {
    const source = `export function UserCard() {\n  return <div>User</div>;\n}`;
    const virtualState = new Map([['test.tsx', { content: source, exists: true }]]);
    const op = {
      strategy: 'replace_node' as const,
      filePath: 'test.tsx',
      content: 'export function UserCard() {\n  return <span>User!</span>;\n}',
      selector: {
        path: [{ kind: 'function' as const, name: 'UserCard' }]
      }
    };

    const exec = await resolveOperation(op, virtualState, CONTEXT);
    expect(exec.afterContent).toBe(`export function UserCard() {\n  return <span>User!</span>;\n}`);
    const slice = source.slice(exec.targetScope.beforeRange!.start, exec.targetScope.beforeRange!.end);
    expect(slice).toBe(source);
  });

  it('replaces an exported TSX const arrow component', async () => {
    const source = `export const UserCard = () => {\n  return <div>Arrow</div>;\n};`;
    const virtualState = new Map([['test.tsx', { content: source, exists: true }]]);
    const op = {
      strategy: 'replace_node' as const,
      filePath: 'test.tsx',
      content: 'export const UserCard = () => {\n  return <span>Arrow Changed</span>;\n};',
      selector: {
        path: [{ kind: 'function' as const, name: 'UserCard' }]
      }
    };

    const exec = await resolveOperation(op, virtualState, CONTEXT);
    expect(exec.afterContent).toBe(`export const UserCard = () => {\n  return <span>Arrow Changed</span>;\n};`);
    const slice = source.slice(exec.targetScope.beforeRange!.start, exec.targetScope.beforeRange!.end);
    expect(slice).toBe(source);
  });

  it('replaces a default-exported TSX function component', async () => {
    const source = `export default function UserCard() {\n  return <div>Default</div>;\n}`;
    const virtualState = new Map([['test.tsx', { content: source, exists: true }]]);
    const op = {
      strategy: 'replace_node' as const,
      filePath: 'test.tsx',
      content: 'export default function UserCard() {\n  return <div>Updated Default</div>;\n}',
      selector: {
        path: [{ kind: 'function' as const, name: 'UserCard' }]
      }
    };

    const exec = await resolveOperation(op, virtualState, CONTEXT);
    expect(exec.afterContent).toBe(`export default function UserCard() {\n  return <div>Updated Default</div>;\n}`);
    const slice = source.slice(exec.targetScope.beforeRange!.start, exec.targetScope.beforeRange!.end);
    expect(slice).toBe(source);
  });

  it('replaces a class method containing JSX', async () => {
    const source = `class View {\n  render() {\n    return <div>JSX</div>;\n  }\n}`;
    const virtualState = new Map([['test.tsx', { content: source, exists: true }]]);
    const op = {
      strategy: 'replace_node' as const,
      filePath: 'test.tsx',
      content: 'render() {\n    return <span>JSX Updated</span>;\n  }',
      selector: {
        path: [
          { kind: 'class' as const, name: 'View' },
          { kind: 'method' as const, name: 'render' }
        ]
      }
    };

    const exec = await resolveOperation(op, virtualState, CONTEXT);
    expect(exec.afterContent).toBe(`class View {\n  render() {\n    return <span>JSX Updated</span>;\n  }\n}`);
  });

  it('replaces repeated if_statement inside a TSX component using multiline STARTS_WITH', async () => {
    const source = `function Comp() {\n  if (a) {\n    return 1;\n  }\n  if (b) {\n    return 2;\n  }\n}`;
    const virtualState = new Map([['test.tsx', { content: source, exists: true }]]);
    const op = {
      strategy: 'replace_node' as const,
      filePath: 'test.tsx',
      content: 'if (b) {\n    return 42;\n  }',
      selector: {
        path: [
          { kind: 'function' as const, name: 'Comp' },
          { kind: 'if_statement' as const }
        ],
        startsWith: 'if (b) {'
      }
    };

    const exec = await resolveOperation(op, virtualState, CONTEXT);
    expect(exec.afterContent).toBe(`function Comp() {\n  if (a) {\n    return 1;\n  }\n  if (b) {\n    return 42;\n  }\n}`);
    const slice = source.slice(exec.targetScope.beforeRange!.start, exec.targetScope.beforeRange!.end);
    expect(slice).toBe('if (b) {\n    return 2;\n  }');
  });

  it('verifies fragments remain inside resolved TSX function boundary', async () => {
    const source = `function Comp() {\n  return <><div /></>;\n}`;
    const virtualState = new Map([['test.tsx', { content: source, exists: true }]]);
    const op = {
      strategy: 'replace_node' as const,
      filePath: 'test.tsx',
      content: 'function Comp() {\n  return <><span /></>;\n}',
      selector: {
        path: [{ kind: 'function' as const, name: 'Comp' }]
      }
    };

    const exec = await resolveOperation(op, virtualState, CONTEXT);
    expect(exec.afterContent).toBe(`function Comp() {\n  return <><span /></>;\n}`);
  });

  it('verifies conditional rendering remains inside resolved TSX function boundary', async () => {
    const source = `function Comp() {\n  return isTrue ? <div>True</div> : <div>False</div>;\n}`;
    const virtualState = new Map([['test.tsx', { content: source, exists: true }]]);
    const op = {
      strategy: 'replace_node' as const,
      filePath: 'test.tsx',
      content: 'function Comp() {\n  return isTrue ? <span>True!</span> : <span>False!</span>;\n}',
      selector: {
        path: [{ kind: 'function' as const, name: 'Comp' }]
      }
    };

    const exec = await resolveOperation(op, virtualState, CONTEXT);
    expect(exec.afterContent).toBe(`function Comp() {\n  return isTrue ? <span>True!</span> : <span>False!</span>;\n}`);
  });

  it('correctly maps Unicode before target', async () => {
    const source = `// Café résumé\nfunction welcome() {\n  return "café";\n}`;
    const virtualState = new Map([['test.ts', { content: source, exists: true }]]);
    const op = {
      strategy: 'replace_node' as const,
      filePath: 'test.ts',
      content: 'function welcome() {\n  return "tea";\n}',
      selector: {
        path: [{ kind: 'function' as const, name: 'welcome' }]
      }
    };

    const exec = await resolveOperation(op, virtualState, CONTEXT);
    expect(exec.afterContent).toBe(`// Café résumé\nfunction welcome() {\n  return "tea";\n}`);
  });

  it('correctly maps emoji before target', async () => {
    const source = `// 🚀 rocket emoji\nfunction welcome() {\n  return "rocket";\n}`;
    const virtualState = new Map([['test.ts', { content: source, exists: true }]]);
    const op = {
      strategy: 'replace_node' as const,
      filePath: 'test.ts',
      content: 'function welcome() {\n  return "landing";\n}',
      selector: {
        path: [{ kind: 'function' as const, name: 'welcome' }]
      }
    };

    const exec = await resolveOperation(op, virtualState, CONTEXT);
    expect(exec.afterContent).toBe(`// 🚀 rocket emoji\nfunction welcome() {\n  return "landing";\n}`);
  });

  it('normalizes CRLF TSX source + LF replacement payload', async () => {
    const source = `function Comp() {\r\n  return <div>CRLF</div>;\r\n}`;
    const virtualState = new Map([['test.tsx', { content: source, exists: true }]]);
    const op = {
      strategy: 'replace_node' as const,
      filePath: 'test.tsx',
      content: 'function Comp() {\n  return <div>LF</div>;\n}',
      selector: {
        path: [{ kind: 'function' as const, name: 'Comp' }]
      }
    };

    const exec = await resolveOperation(op, virtualState, CONTEXT);
    expect(exec.afterContent).toBe(`function Comp() {\r\n  return <div>LF</div>;\r\n}`);
  });

  it('fails with TARGET_AMBIGUOUS for ambiguous structural selector', async () => {
    const source = `function Comp() {\n  if (a) {}\n  if (b) {}\n}`;
    const virtualState = new Map([['test.tsx', { content: source, exists: true }]]);
    const op = {
      strategy: 'replace_node' as const,
      filePath: 'test.tsx',
      content: '  if (c) {}',
      selector: {
        path: [
          { kind: 'function' as const, name: 'Comp' },
          { kind: 'if_statement' as const }
        ]
      }
    };

    await expect(resolveOperation(op, virtualState, CONTEXT)).rejects.toThrow('TARGET_AMBIGUOUS');
  });

  it('fails with TARGET_NOT_FOUND for missing target', async () => {
    const source = `function Comp() {}`;
    const virtualState = new Map([['test.tsx', { content: source, exists: true }]]);
    const op = {
      strategy: 'replace_node' as const,
      filePath: 'test.tsx',
      content: 'function Comp() {}',
      selector: {
        path: [{ kind: 'class' as const, name: 'MissingClass' }]
      }
    };

    await expect(resolveOperation(op, virtualState, CONTEXT)).rejects.toThrow('TARGET_NOT_FOUND');
  });

  it('throws TARGET_QUALIFIER_NOT_MATCHED when STARTS_WITH mismatch', async () => {
    const source = `function Comp() {\n  if (a) {\n    return 1;\n  }\n}`;
    const virtualState = new Map([['test.tsx', { content: source, exists: true }]]);
    const op = {
      strategy: 'replace_node' as const,
      filePath: 'test.tsx',
      content: '  if (a) { return 42; }',
      selector: {
        path: [
          { kind: 'function' as const, name: 'Comp' },
          { kind: 'if_statement' as const }
        ],
        startsWith: 'if (b) {'
      }
    };

    await expect(resolveOperation(op, virtualState, CONTEXT)).rejects.toThrow('TARGET_QUALIFIER_NOT_MATCHED');
  });

  it('fails with UNSUPPORTED_EXTENSION for unsupported extensions', async () => {
    const source = `class Test {}`;
    const virtualState = new Map([['test.java', { content: source, exists: true }]]);
    const op = {
      strategy: 'replace_node' as const,
      filePath: 'test.java',
      content: 'class Test {}',
      selector: {
        path: [{ kind: 'class' as const, name: 'Test' }]
      }
    };

    await expect(resolveOperation(op, virtualState, CONTEXT)).rejects.toThrow('UNSUPPORTED_EXTENSION');
  });

  it('fails with STRUCTURAL_RESOLVER_REQUIRED when structural resolver is missing', async () => {
    const source = `function Comp() {}`;
    const virtualState = new Map([['test.tsx', { content: source, exists: true }]]);
    const op = {
      strategy: 'replace_node' as const,
      filePath: 'test.tsx',
      content: 'function Comp() {}',
      selector: {
        path: [{ kind: 'function' as const, name: 'Comp' }]
      }
    };

    await expect(resolveOperation(op, virtualState, {})).rejects.toThrow('STRUCTURAL_RESOLVER_REQUIRED');
  });

  it('fails with PARSER_DIAGNOSTICS_PRESENT for malformed TSX files', async () => {
    const source = `function Comp() {\n  return <div>\n}`;
    const virtualState = new Map([['test.tsx', { content: source, exists: true }]]);
    const op = {
      strategy: 'replace_node' as const,
      filePath: 'test.tsx',
      content: 'function Comp() {}',
      selector: {
        path: [{ kind: 'function' as const, name: 'Comp' }]
      }
    };

    await expect(resolveOperation(op, virtualState, CONTEXT)).rejects.toThrow('PARSER_DIAGNOSTICS_PRESENT');
  });

  it('fails with PARSER_DIAGNOSTICS_PRESENT for malformed TS with missing closing brace', async () => {
    const source = `function Comp() {\n  if (true) {\n    return 42;\n  \n}`;
    const virtualState = new Map([['test.ts', { content: source, exists: true }]]);
    const op = {
      strategy: 'replace_node' as const,
      filePath: 'test.ts',
      content: 'function Comp() {}',
      selector: {
        path: [{ kind: 'function' as const, name: 'Comp' }]
      }
    };

    await expect(resolveOperation(op, virtualState, CONTEXT)).rejects.toThrow('PARSER_DIAGNOSTICS_PRESENT');
  });

  it('verifies parser and tree disposal', async () => {
    const runtime = await import('../../src/v2/structural/treeSitterRuntime');
    const originalCreateParser = runtime.createParser;
    let parserDeleteSpies: any[] = [];
    let treeDeleteSpies: any[] = [];

    const createParserSpy = vi.spyOn(runtime, 'createParser').mockImplementation(() => {
      const realParser = originalCreateParser();
      const parserSpy = vi.fn().mockImplementation(() => {
        return realParser.delete();
      });
      parserDeleteSpies.push(parserSpy);

      const wrapper = new Proxy(realParser, {
        get(target, prop, receiver) {
          if (prop === 'delete') {
            return parserSpy;
          }
          if (prop === 'parse') {
            return function(this: any, ...args: any[]) {
              const realTree = realParser.parse.apply(realParser, args as any);
              const treeSpy = vi.fn().mockImplementation(() => {
                return realTree.delete();
              });
              treeDeleteSpies.push(treeSpy);

              const treeWrapper = new Proxy(realTree, {
                get(t, p, r) {
                  if (p === 'delete') {
                    return treeSpy;
                  }
                  const val = Reflect.get(t, p, r);
                  if (typeof val === 'function') {
                    return val.bind(t);
                  }
                  return val;
                }
              });
              return treeWrapper;
            };
          }
          const val = Reflect.get(target, prop, receiver);
          if (typeof val === 'function') {
            return val.bind(target);
          }
          return val;
        }
      });

      return wrapper as any;
    });

    try {
      const runResolution = async (opContent: string, selectorPath: any, startsWith?: string) => {
        const source = `function Comp() {\n  if (a) {\n    return 1;\n  }\n}`;
        const virtualState = new Map([['test.ts', { content: source, exists: true }]]);
        const op = {
          strategy: 'replace_node' as const,
          filePath: 'test.ts',
          content: opContent,
          selector: { path: selectorPath, startsWith }
        };
        await resolveOperation(op, virtualState, CONTEXT);
      };

      // 1. Successful resolution
      parserDeleteSpies = [];
      treeDeleteSpies = [];
      await runResolution('function Comp() {}', [{ kind: 'function', name: 'Comp' }]);
      expect(parserDeleteSpies[0]).toHaveBeenCalled();
      expect(treeDeleteSpies[0]).toHaveBeenCalled();

      // 2. TARGET_NOT_FOUND
      parserDeleteSpies = [];
      treeDeleteSpies = [];
      await expect(runResolution('function Comp() {}', [{ kind: 'class', name: 'Comp' }])).rejects.toThrow('TARGET_NOT_FOUND');
      expect(parserDeleteSpies[0]).toHaveBeenCalled();
      expect(treeDeleteSpies[0]).toHaveBeenCalled();

      // 3. TARGET_AMBIGUOUS
      parserDeleteSpies = [];
      treeDeleteSpies = [];
      const sourceAmb = `function Comp() {\n  if (a) {}\n  if (b) {}\n}`;
      const virtualStateAmb = new Map([['test.ts', { content: sourceAmb, exists: true }]]);
      const opAmb = {
        strategy: 'replace_node' as const,
        filePath: 'test.ts',
        content: '  if (c) {}',
        selector: { path: [{ kind: 'function', name: 'Comp' }, { kind: 'if_statement' }] }
      };
      await expect(resolveOperation(opAmb, virtualStateAmb, CONTEXT)).rejects.toThrow('TARGET_AMBIGUOUS');
      expect(parserDeleteSpies[0]).toHaveBeenCalled();
      expect(treeDeleteSpies[0]).toHaveBeenCalled();

      // 4. PARSER_DIAGNOSTICS_PRESENT
      parserDeleteSpies = [];
      treeDeleteSpies = [];
      const sourceDiag = `function Comp() {\n  return <div>\n}`;
      const virtualStateDiag = new Map([['test.tsx', { content: sourceDiag, exists: true }]]);
      const opDiag = {
        strategy: 'replace_node' as const,
        filePath: 'test.tsx',
        content: 'function Comp() {}',
        selector: { path: [{ kind: 'function', name: 'Comp' }] }
      };
      await expect(resolveOperation(opDiag, virtualStateDiag, CONTEXT)).rejects.toThrow('PARSER_DIAGNOSTICS_PRESENT');
      expect(parserDeleteSpies[0]).toHaveBeenCalled();
      expect(treeDeleteSpies[0]).toHaveBeenCalled();
    } finally {
      createParserSpy.mockRestore();
    }
  });

  it('enforces scope-aware traversal boundaries', async () => {
    // 1. Nested class inside function
    const source1 = `function outer() {\n  class Inner {\n    save() {}\n  }\n}`;
    const virtualState1 = new Map([['test.ts', { content: source1, exists: true }]]);
    const op1 = {
      strategy: 'replace_node' as const,
      filePath: 'test.ts',
      content: 'save() {}',
      selector: {
        path: [
          { kind: 'function' as const, name: 'outer' },
          { kind: 'method' as const, name: 'save' }
        ]
      }
    };
    await expect(resolveOperation(op1, virtualState1, CONTEXT)).rejects.toThrow('TARGET_NOT_FOUND');

    const op2 = {
      strategy: 'replace_node' as const,
      filePath: 'test.ts',
      content: 'save() {}',
      selector: {
        path: [
          { kind: 'function' as const, name: 'outer' },
          { kind: 'class' as const, name: 'Inner' },
          { kind: 'method' as const, name: 'save' }
        ]
      }
    };
    await expect(resolveOperation(op2, virtualState1, CONTEXT)).resolves.toBeDefined();

    // 2. Class expression inside function
    const source2 = `function outer() {\n  const Inner = class {\n    save() {}\n  };\n}`;
    const virtualState2 = new Map([['test.ts', { content: source2, exists: true }]]);
    const op3 = {
      strategy: 'replace_node' as const,
      filePath: 'test.ts',
      content: 'save() {}',
      selector: {
        path: [
          { kind: 'function' as const, name: 'outer' },
          { kind: 'method' as const, name: 'save' }
        ]
      }
    };
    await expect(resolveOperation(op3, virtualState2, CONTEXT)).rejects.toThrow('TARGET_NOT_FOUND');

    // 3. Arrow function expression scope barrier
    const source3 = `function outer() {\n  items.forEach(() => {\n    if (hidden) {\n      run();\n    }\n  });\n}`;
    const virtualState3 = new Map([['test.ts', { content: source3, exists: true }]]);
    const op4 = {
      strategy: 'replace_node' as const,
      filePath: 'test.ts',
      content: 'if (hidden) {}',
      selector: {
        path: [
          { kind: 'function' as const, name: 'outer' },
          { kind: 'if_statement' as const }
        ]
      }
    };
    await expect(resolveOperation(op4, virtualState3, CONTEXT)).rejects.toThrow('TARGET_NOT_FOUND');

    // 4. Positive test: direct if-statement resolves
    const source4 = `function outer() {\n  if (visible) {\n    run();\n  }\n}`;
    const virtualState4 = new Map([['test.ts', { content: source4, exists: true }]]);
    const op5 = {
      strategy: 'replace_node' as const,
      filePath: 'test.ts',
      content: 'if (visible) {}',
      selector: {
        path: [
          { kind: 'function' as const, name: 'outer' },
          { kind: 'if_statement' as const }
        ]
      }
    };
    await expect(resolveOperation(op5, virtualState4, CONTEXT)).resolves.toBeDefined();
  });

  it('asserts exact logical replacement ranges including wrappers', async () => {
    const getRangeSlice = async (source: string, path: any, filePath = 'test.tsx') => {
      const resolver = createStructuralResolver(ASSETS);
      const match = await resolver({ source, filePath, selector: { path } });
      return source.slice(match.start, match.end);
    };

    // 1. Exported named function
    const s1 = `export function UserCard() {\n  return <div />;\n}`;
    expect(await getRangeSlice(s1, [{ kind: 'function', name: 'UserCard' }])).toBe(s1);

    // 2. Default-exported function
    const s2 = `export default function UserCard() {\n  return <div />;\n}`;
    expect(await getRangeSlice(s2, [{ kind: 'function', name: 'UserCard' }])).toBe(s2);

    // 3. Exported arrow component
    const s3 = `export const UserCard = () => {\n  return <div />;\n};`;
    expect(await getRangeSlice(s3, [{ kind: 'function', name: 'UserCard' }])).toBe(s3);

    // 4. Non-exported arrow function
    const s4 = `const UserCard = () => {\n  return <div />;\n};`;
    expect(await getRangeSlice(s4, [{ kind: 'function', name: 'UserCard' }])).toBe(s4);

    // 5. Exported class
    const s5 = `export class UserService {}`;
    expect(await getRangeSlice(s5, [{ kind: 'class', name: 'UserService' }])).toBe(s5);

    // 6. Non-exported class
    const s6 = `class UserService {}`;
    expect(await getRangeSlice(s6, [{ kind: 'class', name: 'UserService' }])).toBe(s6);

    // 7. var arrow function
    const s7 = `var UserCard = () => {\n  return <div />;\n};`;
    expect(await getRangeSlice(s7, [{ kind: 'function', name: 'UserCard' }])).toBe(s7);

    // 8. var function expression
    const s8 = `var UserCard = function () {\n  return <div />;\n};`;
    expect(await getRangeSlice(s8, [{ kind: 'function', name: 'UserCard' }])).toBe(s8);
  });

  it('rejects multi-declarator arrow function with UNSUPPORTED_NODE_SHAPE', async () => {
    const source = `const UserCard = () => <div />, OtherCard = () => <span />;`;
    const virtualState = new Map([['test.tsx', { content: source, exists: true }]]);
    const op = {
      strategy: 'replace_node' as const,
      filePath: 'test.tsx',
      content: '() => <span />',
      selector: {
        path: [{ kind: 'function' as const, name: 'UserCard' }]
      }
    };
    await expect(resolveOperation(op, virtualState, CONTEXT)).rejects.toThrow('UNSUPPORTED_NODE_SHAPE');
  });

  it('asserts startsWith matches logical replacement node source exactly', async () => {
    const source = `export const UserCard = () => {\n  return <div />;\n};`;
    const virtualState = new Map([['test.tsx', { content: source, exists: true }]]);
    const op = {
      strategy: 'replace_node' as const,
      filePath: 'test.tsx',
      content: 'export const UserCard = () => {\n  return <span />;\n};',
      selector: {
        path: [{ kind: 'function' as const, name: 'UserCard' }],
        startsWith: 'export const UserCard = () => {\n'
      }
    };
    const exec = await resolveOperation(op, virtualState, CONTEXT);
    expect(exec.afterContent).toContain('span');
  });

  it('compares STARTS_WITH against exact logical node source when target starts partway through a line', async () => {
    const source = `if (a) { run1(); } else if (b) { run2(); }`;
    const virtualState = new Map([['test.ts', { content: source, exists: true }]]);
    const op = {
      strategy: 'replace_node' as const,
      filePath: 'test.ts',
      content: 'if (c) { run3(); }',
      selector: {
        path: [{ kind: 'if_statement' as const }],
        startsWith: 'if (b)'
      }
    };
    const exec = await resolveOperation(op, virtualState, CONTEXT);
    expect(exec.afterContent).toBe('if (a) { run1(); } else if (c) { run3(); }');
  });

  it('multi-declarator arrow function with STARTS_WITH propagates UNSUPPORTED_NODE_SHAPE error', async () => {
    const source = `const UserCard = () => <div />, OtherCard = () => <span />;`;
    const virtualState = new Map([['test.tsx', { content: source, exists: true }]]);
    const op = {
      strategy: 'replace_node' as const,
      filePath: 'test.tsx',
      content: '() => <span />',
      selector: {
        path: [{ kind: 'function' as const, name: 'UserCard' }],
        startsWith: 'const UserCard'
      }
    };
    await expect(resolveOperation(op, virtualState, CONTEXT)).rejects.toThrow('UNSUPPORTED_NODE_SHAPE');
  });

  it('nested generator function expression acts as a scope barrier', async () => {
    const source = `function outer() {\n  const iterate = function* () {\n    if (hidden) {\n      run();\n    }\n  };\n}`;
    const virtualState = new Map([['test.ts', { content: source, exists: true }]]);
    const op = {
      strategy: 'replace_node' as const,
      filePath: 'test.ts',
      content: 'if (hidden) {}',
      selector: {
        path: [
          { kind: 'function' as const, name: 'outer' },
          { kind: 'if_statement' as const }
        ]
      }
    };
    await expect(resolveOperation(op, virtualState, CONTEXT)).rejects.toThrow('TARGET_NOT_FOUND');
  });

  it('asserts INVALID_SELECTOR for resolver-boundary violations including blank metadata', async () => {
    const source = `function outer() {}`;
    const virtualState = new Map([['test.ts', { content: source, exists: true }]]);

    const op1: any = { strategy: 'replace_node' as const, filePath: 'test.ts', content: 'test' };
    await expect(resolveOperation(op1, virtualState, CONTEXT)).rejects.toThrow('INVALID_SELECTOR');

    const op2: any = { strategy: 'replace_node' as const, filePath: 'test.ts', content: 'test', selector: { path: {} } };
    await expect(resolveOperation(op2, virtualState, CONTEXT)).rejects.toThrow('INVALID_SELECTOR');

    const op3: any = { strategy: 'replace_node' as const, filePath: 'test.ts', content: 'test', selector: { path: [] } };
    await expect(resolveOperation(op3, virtualState, CONTEXT)).rejects.toThrow('INVALID_SELECTOR');

    const op4: any = { strategy: 'replace_node' as const, filePath: 'test.ts', content: 'test', selector: { path: [null] } };
    await expect(resolveOperation(op4, virtualState, CONTEXT)).rejects.toThrow('INVALID_SELECTOR');

    const op5: any = { strategy: 'replace_node' as const, filePath: 'test.ts', content: 'test', selector: { path: [{ kind: 'unsupported' }] } };
    await expect(resolveOperation(op5, virtualState, CONTEXT)).rejects.toThrow('INVALID_SELECTOR');

    // segment.name is not a string
    const op6: any = { strategy: 'replace_node' as const, filePath: 'test.ts', content: 'test', selector: { path: [{ kind: 'function', name: 123 }] } };
    await expect(resolveOperation(op6, virtualState, CONTEXT)).rejects.toThrow('INVALID_SELECTOR');

    // segment.name is an empty string
    const op7: any = { strategy: 'replace_node' as const, filePath: 'test.ts', content: 'test', selector: { path: [{ kind: 'function', name: '' }] } };
    await expect(resolveOperation(op7, virtualState, CONTEXT)).rejects.toThrow('INVALID_SELECTOR');

    // segment.name is whitespace only
    const op8: any = { strategy: 'replace_node' as const, filePath: 'test.ts', content: 'test', selector: { path: [{ kind: 'function', name: '   ' }] } };
    await expect(resolveOperation(op8, virtualState, CONTEXT)).rejects.toThrow('INVALID_SELECTOR');

    // selector.startsWith is not a string
    const op9: any = { strategy: 'replace_node' as const, filePath: 'test.ts', content: 'test', selector: { path: [{ kind: 'function', name: 'outer' }], startsWith: 123 } };
    await expect(resolveOperation(op9, virtualState, CONTEXT)).rejects.toThrow('INVALID_SELECTOR');

    // selector.startsWith is an empty string
    const op10: any = { strategy: 'replace_node' as const, filePath: 'test.ts', content: 'test', selector: { path: [{ kind: 'function', name: 'outer' }], startsWith: '' } };
    await expect(resolveOperation(op10, virtualState, CONTEXT)).rejects.toThrow('INVALID_SELECTOR');

    // selector.startsWith is whitespace only
    const op11: any = { strategy: 'replace_node' as const, filePath: 'test.ts', content: 'test', selector: { path: [{ kind: 'function', name: 'outer' }], startsWith: '   ' } };
    await expect(resolveOperation(op11, virtualState, CONTEXT)).rejects.toThrow('INVALID_SELECTOR');
  });
});
