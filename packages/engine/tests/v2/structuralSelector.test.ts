import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { createAdapterStructuralResolver } from '../../src/v2/structural/resolveStructuralTarget';
import { createTypeScriptLanguageAdapter, createV2LanguageRegistry } from '../../src/v2/languages';
import { parseSelector } from '../../src/v2/structural/selectorParser';

const CORE_WASM = path.resolve(__dirname, '../../../../node_modules/web-tree-sitter/tree-sitter.wasm');
const TS_WASM = path.resolve(__dirname, '../../../../node_modules/tree-sitter-wasms/out/tree-sitter-typescript.wasm');
const TSX_WASM = path.resolve(__dirname, '../../../../node_modules/tree-sitter-wasms/out/tree-sitter-tsx.wasm');

const ASSETS = {
  coreWasmPath: CORE_WASM,
  languageWasmPaths: { typescript: TS_WASM, tsx: TSX_WASM },
};

const resolver = createAdapterStructuralResolver(
  createV2LanguageRegistry([createTypeScriptLanguageAdapter(ASSETS)]),
);

describe('Structural selectors', () => {
  it('uniquely resolves class > method path', async () => {
    const source = `
      class UserService {
        save() {
          console.log("saving");
        }
      }
    `;
    const selector = parseSelector('class:UserService > method:save');
    const match = await resolver({ source, filePath: 'test.ts', selector });

    expect(match.kind).toBe('method');
    expect(match.name).toBe('save');
    const sliced = source.slice(match.start, match.end);
    expect(sliced).toContain('save()');
    expect(sliced).toContain('saving');
  });

  it('resolves TypeScript constructors and nested control-flow statements', async () => {
    const source = `
      // 🚀
      class Counter {
        constructor(initial: number) {
          this.value = initial;
        }

        run() {
          for (let i = 0; i < 1; i++) {
            while (i < 1) {
              switch (i) {
                case 0:
                  this.value++;
                  break;
                default:
                  break;
              }
            }
          }
        }
      }
    `;

    const constructorMatch = await resolver({
      source,
      filePath: 'counter.ts',
      selector: parseSelector('class:Counter > constructor'),
    });
    expect(source.slice(constructorMatch.start, constructorMatch.end)).toContain(
      'constructor(initial: number)',
    );

    const forMatch = await resolver({
      source,
      filePath: 'counter.ts',
      selector: parseSelector('class:Counter > method:run > for_statement'),
    });
    expect(source.slice(forMatch.start, forMatch.end)).toMatch(/^for \(/);

    const whileMatch = await resolver({
      source,
      filePath: 'counter.ts',
      selector: parseSelector(
        'class:Counter > method:run > for_statement > while_statement',
      ),
    });
    expect(source.slice(whileMatch.start, whileMatch.end)).toMatch(/^while \(/);

    const switchMatch = await resolver({
      source,
      filePath: 'counter.ts',
      selector: parseSelector(
        'class:Counter > method:run > for_statement > while_statement > switch_statement',
      ),
    });
    expect(source.slice(switchMatch.start, switchMatch.end)).toMatch(/^switch \(/);
  });

  it('fails with TARGET_NOT_FOUND when node does not exist', async () => {
    const source = `
      class UserService {
        save() {}
      }
    `;
    const selector = parseSelector('class:UserService > method:delete');
    await expect(resolver({ source, filePath: 'test.ts', selector })).rejects.toThrow('TARGET_NOT_FOUND');
  });

  it('fails with TARGET_AMBIGUOUS when multiple candidates match and no startsWith is provided', async () => {
    const source = `
      function saveUser() {
        if (!user.name) {
          throw new Error('Missing name');
        }
        if (!user.email) {
          throw new Error('Missing email');
        }
      }
    `;
    const selector = parseSelector('function:saveUser > if_statement');
    await expect(resolver({ source, filePath: 'test.ts', selector })).rejects.toThrow('TARGET_AMBIGUOUS');
  });

  it('resolves unique candidate using STARTS_WITH qualifier', async () => {
    const source = `
      function saveUser() {
        if (!user.name) {
          throw new Error('Missing name');
        }
        if (!user.email) {
          throw new Error('Missing email');
        }
      }
    `;
    const selector = parseSelector(
      'function:saveUser > if_statement',
      "if (!user.email) {"
    );
    const match = await resolver({ source, filePath: 'test.ts', selector });

    expect(match.kind).toBe('if_statement');
    const sliced = source.slice(match.start, match.end);
    expect(sliced).toContain('Missing email');
    expect(sliced).not.toContain('Missing name');
  });

  it('uniquely resolves components/methods in TSX file', async () => {
    const source = `
      function MyComponent() {
        if (loading) {
          return <div>Loading...</div>;
        }
        return <button onClick={save}>Click</button>;
      }
    `;
    const selector = parseSelector('function:MyComponent > if_statement');
    const match = await resolver({ source, filePath: 'test.tsx', selector });

    expect(match.kind).toBe('if_statement');
    const sliced = source.slice(match.start, match.end);
    expect(sliced).toContain('Loading...');
  });

  it('resolves constructors through the TSX grammar variant', async () => {
    const source = `
      class Counter extends React.Component<Props> {
        constructor(props: Props) {
          super(props);
        }

        render() {
          return <div />;
        }
      }
    `;
    const match = await resolver({
      source,
      filePath: 'counter.tsx',
      selector: parseSelector('class:Counter > constructor'),
    });

    expect(source.slice(match.start, match.end)).toContain('super(props);');
  });

  it('normalizes real-world TypeScript declaration and loop variants', async () => {
    const source = `@sealed()
export default abstract class Box<T> {
  @log
  protected constructor(readonly value: T) {}

  @log
  async *items() {
    yield this.value;
  }

  overload(value: string): void;

  run(values: T[]) {
    for (const value of values) {}
    for (const key in values) {}
    for (let index = 0; index < 1; index++) {}
  }

  handler = async () => {};
  generator = function* () {};
}
`;

    const classMatch = await resolver({
      source,
      filePath: 'box.ts',
      selector: parseSelector('class:Box'),
    });
    expect(source.slice(classMatch.start, classMatch.end)).toBe(source.trimEnd());

    const constructorMatch = await resolver({
      source,
      filePath: 'box.ts',
      selector: parseSelector('class:Box > constructor'),
    });
    expect(source.slice(constructorMatch.start, constructorMatch.end)).toBe(
      '@log\n  protected constructor(readonly value: T) {}',
    );

    const overloadMatch = await resolver({
      source,
      filePath: 'box.ts',
      selector: parseSelector('class:Box > method:overload'),
    });
    expect(source.slice(overloadMatch.start, overloadMatch.end)).toBe(
      'overload(value: string): void;',
    );

    const ofMatch = await resolver({
      source,
      filePath: 'box.ts',
      selector: parseSelector('class:Box > method:run > for_statement', 'for (const value of values)'),
    });
    expect(source.slice(ofMatch.start, ofMatch.end)).toBe('for (const value of values) {}');

    const inMatch = await resolver({
      source,
      filePath: 'box.ts',
      selector: parseSelector('class:Box > method:run > for_statement', 'for (const key in values)'),
    });
    expect(source.slice(inMatch.start, inMatch.end)).toBe('for (const key in values) {}');

    const classicMatch = await resolver({
      source,
      filePath: 'box.ts',
      selector: parseSelector('class:Box > method:run > for_statement', 'for (let index = 0;'),
    });
    expect(source.slice(classicMatch.start, classicMatch.end)).toBe(
      'for (let index = 0; index < 1; index++) {}',
    );

    const fieldMatch = await resolver({
      source,
      filePath: 'box.ts',
      selector: parseSelector('class:Box > function:handler'),
    });
    expect(source.slice(fieldMatch.start, fieldMatch.end)).toBe('handler = async () => {};');

    const generatorFieldMatch = await resolver({
      source,
      filePath: 'box.ts',
      selector: parseSelector('class:Box > function:generator'),
    });
    expect(source.slice(generatorFieldMatch.start, generatorFieldMatch.end)).toBe(
      'generator = function* () {};',
    );

    const tsxSource = `export default abstract class View {
  render = async () => <div />;
}`;
    const tsxFieldMatch = await resolver({
      source: tsxSource,
      filePath: 'view.tsx',
      selector: parseSelector('class:View > function:render'),
    });
    expect(tsxSource.slice(tsxFieldMatch.start, tsxFieldMatch.end)).toBe(
      'render = async () => <div />;',
    );
  });

  it('keeps TypeScript class-field function bodies behind the owner boundary', async () => {
    const source = `class Controller {
  handler = async () => {
    if (hidden) return;
  };
}
`;

    await expect(resolver({
      source,
      filePath: 'controller.ts',
      selector: parseSelector('class:Controller > if_statement'),
    })).rejects.toThrow('TARGET_NOT_FOUND');
  });

  it('normalizes composed TypeScript declaration ranges to UTF-16 offsets', async () => {
    const source = `// 😀 leading text
class Service {
  @methodDecorator
  async load() {}

  @constructorDecorator
  constructor(value: string) {}

  overload(value: string): void;

  @fieldDecorator
  handler = async () => {};
}
`;

    const methodMatch = await resolver({
      source,
      filePath: 'service.ts',
      selector: parseSelector('class:Service > method:load'),
    });
    const methodStart = source.indexOf('@methodDecorator');
    expect(methodMatch.start).toBe(methodStart);
    expect(source.slice(methodMatch.start, methodMatch.end)).toBe(
      '@methodDecorator\n  async load() {}',
    );

    const constructorMatch = await resolver({
      source,
      filePath: 'service.ts',
      selector: parseSelector('class:Service > constructor'),
    });
    const constructorStart = source.indexOf('@constructorDecorator');
    expect(constructorMatch.start).toBe(constructorStart);
    expect(source.slice(constructorMatch.start, constructorMatch.end)).toBe(
      '@constructorDecorator\n  constructor(value: string) {}',
    );

    const overloadMatch = await resolver({
      source,
      filePath: 'service.ts',
      selector: parseSelector('class:Service > method:overload'),
    });
    const overloadStart = source.indexOf('overload(value: string)');
    expect(overloadMatch.start).toBe(overloadStart);
    expect(source.slice(overloadMatch.start, overloadMatch.end)).toBe(
      'overload(value: string): void;',
    );

    const fieldMatch = await resolver({
      source,
      filePath: 'service.ts',
      selector: parseSelector('class:Service > function:handler'),
    });
    const fieldStart = source.indexOf('@fieldDecorator');
    expect(fieldMatch.start).toBe(fieldStart);
    expect(source.slice(fieldMatch.start, fieldMatch.end)).toBe(
      '@fieldDecorator\n  handler = async () => {};',
    );
  });

  it('fails on unsupported kinds', () => {
    expect(() => parseSelector('class:UserService > arrow_function')).toThrow(
      'Unsupported structural selector kind: arrow_function'
    );
  });
});
