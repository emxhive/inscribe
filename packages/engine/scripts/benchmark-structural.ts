import * as path from 'path';
import { performance } from 'perf_hooks';
import { initTreeSitter, loadLanguage, createParser } from '../src/v2/structural/treeSitterRuntime';
import { createStructuralResolver } from '../src/v2/structural/resolveStructuralTarget';
import { parseSelector } from '../src/v2/structural/selectorParser';

const CORE_WASM = path.resolve(__dirname, '../node_modules/web-tree-sitter/tree-sitter.wasm');
const TS_WASM = path.resolve(__dirname, '../../../node_modules/tree-sitter-wasms/out/tree-sitter-typescript.wasm');
const TSX_WASM = path.resolve(__dirname, '../../../node_modules/tree-sitter-wasms/out/tree-sitter-tsx.wasm');

const tsSource = `
class UserService {
  save() {
    if (!user.name) {
      throw new Error('Missing name');
    }
  }
}
`;

const tsxSource = `
function MyComponent() {
  if (loading) {
    return <div>Loading...</div>;
  }
  return <button onClick={save}>Click</button>;
}
`;

async function runBenchmark() {
  console.log('--- Starting Tree-sitter V2 Benchmark ---');

  // 1. Runtime initialization
  const t0 = performance.now();
  await initTreeSitter({
    coreWasmPath: CORE_WASM,
    typescriptWasmPath: TS_WASM,
    tsxWasmPath: TSX_WASM,
  });
  const t1 = performance.now();
  console.log(`Runtime initialization: ${(t1 - t0).toFixed(2)}ms`);

  // 2. Grammar loading
  const t2 = performance.now();
  const tsLanguage = await loadLanguage(TS_WASM);
  const t3 = performance.now();
  console.log(`Grammar loading (TypeScript): ${(t3 - t2).toFixed(2)}ms`);

  const t4 = performance.now();
  const tsxLanguage = await loadLanguage(TSX_WASM);
  const t5 = performance.now();
  console.log(`Grammar loading (TSX): ${(t5 - t4).toFixed(2)}ms`);

  const parser = createParser();

  // 3. First parse (TypeScript)
  parser.setLanguage(tsLanguage);
  const t6 = performance.now();
  const tsTree = parser.parse(tsSource);
  const t7 = performance.now();
  console.log(`First parse (TypeScript): ${(t7 - t6).toFixed(2)}ms`);

  // 4. Warm parse (TypeScript)
  const t8 = performance.now();
  parser.parse(tsSource);
  const t9 = performance.now();
  console.log(`Warm parse (TypeScript): ${(t9 - t8).toFixed(2)}ms`);

  // 5. First parse (TSX)
  parser.setLanguage(tsxLanguage);
  const t10 = performance.now();
  parser.parse(tsxSource);
  const t11 = performance.now();
  console.log(`First parse (TSX): ${(t11 - t10).toFixed(2)}ms`);

  // 6. Warm parse (TSX)
  const t12 = performance.now();
  parser.parse(tsxSource);
  const t13 = performance.now();
  console.log(`Warm parse (TSX): ${(t13 - t12).toFixed(2)}ms`);

  // 7. Selector resolution & STARTS_WITH filtering
  parser.setLanguage(tsLanguage);
  const selector = parseSelector(
    'class:UserService > method:save > if_statement',
    `if (!user.name) {
      throw new Error('Missing name');
    }`
  );

  const resolver = createStructuralResolver({
    coreWasmPath: CORE_WASM,
    typescriptWasmPath: TS_WASM,
    tsxWasmPath: TSX_WASM,
  });

  const t14 = performance.now();
  const match = await resolver({
    source: tsSource,
    filePath: 'test.ts',
    selector,
  });
  const t15 = performance.now();
  console.log(`Selector resolution & STARTS_WITH filtering: ${(t15 - t14).toFixed(2)}ms`);
  console.log(`Resolved Node Range: start=${match.start}, end=${match.end}`);
  console.log(`Sliced content:\n${tsSource.slice(match.start, match.end)}`);

  console.log('--- Benchmark Finished ---');
}

runBenchmark().catch(console.error);
