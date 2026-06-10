import { describe, it, expect, beforeAll } from 'vitest';
import * as path from 'path';
import { initTreeSitter, loadLanguage, createParser } from '../../src/v2/structural/treeSitterRuntime';
import { resolveNodeRange } from '../../src/v2/structural/resolveNodeRange';
import { parseSelector } from '../../src/v2/structural/selectorParser';

const CORE_WASM = path.resolve(__dirname, '../../node_modules/web-tree-sitter/tree-sitter.wasm');
const TS_WASM = path.resolve(__dirname, '../../../../node_modules/tree-sitter-wasms/out/tree-sitter-typescript.wasm');
const TSX_WASM = path.resolve(__dirname, '../../../../node_modules/tree-sitter-wasms/out/tree-sitter-tsx.wasm');

let parser: any;
let tsLanguage: any;
let tsxLanguage: any;

beforeAll(async () => {
  await initTreeSitter({
    coreWasmPath: CORE_WASM,
    typescriptWasmPath: TS_WASM,
    tsxWasmPath: TSX_WASM,
  });
  tsLanguage = await loadLanguage(TS_WASM);
  tsxLanguage = await loadLanguage(TSX_WASM);
  parser = createParser();
});

describe('Structural selectors', () => {
  it('uniquely resolves class > method path', () => {
    parser.setLanguage(tsLanguage);
    const source = `
      class UserService {
        save() {
          console.log("saving");
        }
      }
    `;
    const tree = parser.parse(source);
    const selector = parseSelector('class:UserService > method:save');
    const match = resolveNodeRange(source, tree, selector);

    expect(match.kind).toBe('method');
    expect(match.name).toBe('save');
    const sliced = source.slice(match.start, match.end);
    expect(sliced).toContain('save()');
    expect(sliced).toContain('saving');
  });

  it('fails with TARGET_NOT_FOUND when node does not exist', () => {
    parser.setLanguage(tsLanguage);
    const source = `
      class UserService {
        save() {}
      }
    `;
    const tree = parser.parse(source);
    const selector = parseSelector('class:UserService > method:delete');
    expect(() => resolveNodeRange(source, tree, selector)).toThrow('TARGET_NOT_FOUND');
  });

  it('fails with TARGET_AMBIGUOUS when multiple candidates match and no startsWith is provided', () => {
    parser.setLanguage(tsLanguage);
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
    const tree = parser.parse(source);
    const selector = parseSelector('function:saveUser > if_statement');
    expect(() => resolveNodeRange(source, tree, selector)).toThrow('TARGET_AMBIGUOUS');
  });

  it('resolves unique candidate using STARTS_WITH qualifier', () => {
    parser.setLanguage(tsLanguage);
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
    const tree = parser.parse(source);
    const selector = parseSelector(
      'function:saveUser > if_statement',
      `
      if (!user.email) {
        throw new Error('Missing email');
      }
      `
    );
    const match = resolveNodeRange(source, tree, selector);

    expect(match.kind).toBe('if_statement');
    const sliced = source.slice(match.start, match.end);
    expect(sliced).toContain('Missing email');
    expect(sliced).not.toContain('Missing name');
  });

  it('uniquely resolves components/methods in TSX file', () => {
    parser.setLanguage(tsxLanguage);
    const source = `
      function MyComponent() {
        if (loading) {
          return <div>Loading...</div>;
        }
        return <button onClick={save}>Click</button>;
      }
    `;
    const tree = parser.parse(source);
    const selector = parseSelector('function:MyComponent > if_statement');
    const match = resolveNodeRange(source, tree, selector);

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
