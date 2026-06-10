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

beforeAll(async () => {
  await initTreeSitter({
    coreWasmPath: CORE_WASM,
    typescriptWasmPath: TS_WASM,
    tsxWasmPath: TSX_WASM,
  });
  tsLanguage = await loadLanguage(TS_WASM);
  parser = createParser();
  parser.setLanguage(tsLanguage);
});

describe('Tree-sitter offset verification', () => {
  it('correctly maps ASCII source with LF', () => {
    const source = `function greet() {\n  if (true) {\n    console.log("hello");\n  }\n}`;
    const tree = parser.parse(source);
    const selector = parseSelector('function:greet > if_statement');
    const match = resolveNodeRange(source, tree, selector);

    const sliced = source.slice(match.start, match.end);
    expect(sliced).toContain('if (true)');
    expect(sliced).toContain('console.log("hello");');
  });

  it('correctly maps ASCII source with CRLF', () => {
    const source = `function greet() {\r\n  if (true) {\r\n    console.log("hello");\r\n  }\r\n}`;
    const tree = parser.parse(source);
    const selector = parseSelector('function:greet > if_statement');
    const match = resolveNodeRange(source, tree, selector);

    const sliced = source.slice(match.start, match.end);
    expect(sliced).toContain('if (true)');
    expect(sliced).toContain('console.log("hello");');
  });

  it('correctly maps source with accent characters (é)', () => {
    const source = `// Café\nfunction résumé() {\n  if (verify) {\n    return true;\n  }\n}`;
    const tree = parser.parse(source);
    const selector = parseSelector('function:résumé > if_statement');
    const match = resolveNodeRange(source, tree, selector);

    const sliced = source.slice(match.start, match.end);
    expect(sliced).toContain('if (verify)');
  });

  it('correctly maps source with CJK characters (中)', () => {
    const source = `// 中文注释\nfunction 中国() {\n  if (测试) {\n    return "中";\n  }\n}`;
    const tree = parser.parse(source);
    const selector = parseSelector('function:中国 > if_statement');
    const match = resolveNodeRange(source, tree, selector);

    const sliced = source.slice(match.start, match.end);
    expect(sliced).toContain('if (测试)');
  });

  it('correctly maps source with emoji before target', () => {
    const source = `// 🚀 Unicode Rocket Emoji\nfunction launcher() {\n  if (active) {\n    fire();\n  }\n}`;
    const tree = parser.parse(source);
    const selector = parseSelector('function:launcher > if_statement');
    const match = resolveNodeRange(source, tree, selector);

    const sliced = source.slice(match.start, match.end);
    expect(sliced).toContain('if (active)');
  });

  it('correctly maps source with emoji inside preceding line of target', () => {
    const source = `function launcher() {\n  // Preceding line 🌟 containing emoji\n  if (active) {\n    fire();\n  }\n}`;
    const tree = parser.parse(source);
    const selector = parseSelector('function:launcher > if_statement');
    const match = resolveNodeRange(source, tree, selector);

    const sliced = source.slice(match.start, match.end);
    expect(sliced).toContain('if (active)');
  });

  it('correctly maps source with emoji inside target itself', () => {
    const source = `function launcher() {\n  if (status === '🔥') {\n    abort();\n  }\n}`;
    const tree = parser.parse(source);
    const selector = parseSelector('function:launcher > if_statement');
    const match = resolveNodeRange(source, tree, selector);

    const sliced = source.slice(match.start, match.end);
    expect(sliced).toContain("status === '🔥'");
  });
});
