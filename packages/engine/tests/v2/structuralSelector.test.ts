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

  it('fails on unsupported kinds', () => {
    expect(() => parseSelector('class:UserService > arrow_function')).toThrow(
      'Unsupported structural selector kind: arrow_function'
    );
  });
});
