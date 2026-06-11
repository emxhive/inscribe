import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as path from 'path';
import { initTreeSitter, loadLanguage, createParser } from '../../src/v2/structural/treeSitterRuntime';
import { treeSitterRangeToJsRange } from '../../src/v2/structural/treeSitterRangeToJsRange';
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

let parser: any;
let tsLanguage: any;

beforeAll(async () => {
  await initTreeSitter(ASSETS);
  tsLanguage = await loadLanguage(TS_WASM);
  parser = createParser();
  parser.setLanguage(tsLanguage);
});

afterAll(() => {
  if (parser) {
    parser.delete();
  }
});

describe('Tree-sitter offset verification', () => {
  it('directly verifies treeSitterRangeToJsRange with unicode offsets', () => {
    const source = `// Café\nconst x = 1;`;
    let tree;
    try {
      tree = parser.parse(source);
      const startIdx = source.indexOf('const x = 1;');
      const endIdx = startIdx + 'const x = 1;'.length;
      const node = tree.rootNode.descendantForIndex(startIdx, endIdx);

      // Empirically verify that treeSitterRangeToJsRange correctly maps UTF-8 offsets to JS UTF-16 code units.
      const jsRange = treeSitterRangeToJsRange(source, node);
      expect(source.slice(jsRange.start, jsRange.end)).toBe('const x = 1;');
    } finally {
      if (tree) {
        tree.delete();
      }
    }
  });

  it('correctly maps ASCII source with LF', async () => {
    const resolver = createStructuralResolver(ASSETS);
    const source = `function greet() {\n  if (true) {\n    console.log("hello");\n  }\n}`;
    const selector = parseSelector('function:greet > if_statement');
    const match = await resolver({ source, filePath: 'test.ts', selector });

    const sliced = source.slice(match.start, match.end);
    expect(sliced).toContain('if (true)');
    expect(sliced).toContain('console.log("hello");');
  });

  it('correctly maps ASCII source with CRLF', async () => {
    const resolver = createStructuralResolver(ASSETS);
    const source = `function greet() {\r\n  if (true) {\r\n    console.log("hello");\r\n  }\r\n}`;
    const selector = parseSelector('function:greet > if_statement');
    const match = await resolver({ source, filePath: 'test.ts', selector });

    const sliced = source.slice(match.start, match.end);
    expect(sliced).toContain('if (true)');
    expect(sliced).toContain('console.log("hello");');
  });

  it('correctly maps source with accent characters (é)', async () => {
    const resolver = createStructuralResolver(ASSETS);
    const source = `// Café\nfunction résumé() {\n  if (verify) {\n    return true;\n  }\n}`;
    const selector = parseSelector('function:résumé > if_statement');
    const match = await resolver({ source, filePath: 'test.ts', selector });

    const sliced = source.slice(match.start, match.end);
    expect(sliced).toContain('if (verify)');
  });

  it('correctly maps source with CJK characters (中)', async () => {
    const resolver = createStructuralResolver(ASSETS);
    const source = `// 中文注释\nfunction 中国() {\n  if (测试) {\n    return "中";\n  }\n}`;
    const selector = parseSelector('function:中国 > if_statement');
    const match = await resolver({ source, filePath: 'test.ts', selector });

    const sliced = source.slice(match.start, match.end);
    expect(sliced).toContain('if (测试)');
  });

  it('correctly maps source with emoji before target', async () => {
    const resolver = createStructuralResolver(ASSETS);
    const source = `// 🚀 Unicode Rocket Emoji\nfunction launcher() {\n  if (active) {\n    fire();\n  }\n}`;
    const selector = parseSelector('function:launcher > if_statement');
    const match = await resolver({ source, filePath: 'test.ts', selector });

    const sliced = source.slice(match.start, match.end);
    expect(sliced).toContain('if (active)');
  });

  it('correctly maps source with emoji inside preceding line of target', async () => {
    const resolver = createStructuralResolver(ASSETS);
    const source = `function launcher() {\n  // Preceding line 🌟 containing emoji\n  if (active) {\n    fire();\n  }\n}`;
    const selector = parseSelector('function:launcher > if_statement');
    const match = await resolver({ source, filePath: 'test.ts', selector });

    const sliced = source.slice(match.start, match.end);
    expect(sliced).toContain('if (active)');
  });

  it('correctly maps source with emoji inside target itself', async () => {
    const resolver = createStructuralResolver(ASSETS);
    const source = `function launcher() {\n  if (status === '🔥') {\n    abort();\n  }\n}`;
    const selector = parseSelector('function:launcher > if_statement');
    const match = await resolver({ source, filePath: 'test.ts', selector });

    const sliced = source.slice(match.start, match.end);
    expect(sliced).toContain("status === '🔥'");
  });
});
