import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { createStructuralResolver } from '../../src/v2/structural/resolveStructuralTarget';
import { parseSelector } from '../../src/v2/structural/selectorParser';

const CORE_WASM = path.resolve(__dirname, '../../node_modules/web-tree-sitter/tree-sitter.wasm');
const TS_WASM = path.resolve(__dirname, '../../../../node_modules/tree-sitter-wasms/out/tree-sitter-typescript.wasm');
const TSX_WASM = path.resolve(__dirname, '../../../../node_modules/tree-sitter-wasms/out/tree-sitter-tsx.wasm');

const ASSETS = {
  coreWasmPath: CORE_WASM,
  typescriptWasmPath: TS_WASM,
  tsxWasmPath: TSX_WASM,
};

const resolver = createStructuralResolver(ASSETS);

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

  it('fails on unsupported kinds', () => {
    expect(() => parseSelector('class:UserService > arrow_function')).toThrow(
      'Unsupported structural selector kind: arrow_function'
    );
  });
});
