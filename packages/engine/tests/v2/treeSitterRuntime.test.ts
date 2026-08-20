import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as path from 'path';
import Parser from 'web-tree-sitter';
import { initTreeSitter, loadLanguage, resetRuntimeForTesting } from '../../src/v2/structural/treeSitterRuntime';

const CORE_WASM = path.resolve(__dirname, '../../../../node_modules/web-tree-sitter/tree-sitter.wasm');
const TS_WASM = path.resolve(__dirname, '../../../../node_modules/tree-sitter-wasms/out/tree-sitter-typescript.wasm');

const ASSETS = {
  coreWasmPath: CORE_WASM,
  typescriptWasmPath: TS_WASM,
  tsxWasmPath: TS_WASM,
};

describe('Tree-sitter runtime caching and safety', () => {
  beforeEach(() => {
    resetRuntimeForTesting();
  });

  it('same core WASM path may initialize repeatedly without reloading', async () => {
    await initTreeSitter(ASSETS);
    // Second initialization with the exact same paths should succeed/resolve
    await expect(initTreeSitter(ASSETS)).resolves.not.toThrow();
  });

  it('conflicting core WASM path rejects clearly', async () => {
    await initTreeSitter(ASSETS);
    const conflictingAssets = {
      ...ASSETS,
      coreWasmPath: path.resolve(__dirname, '../../../../node_modules/web-tree-sitter/tree-sitter-other.wasm'),
    };
    await expect(initTreeSitter(conflictingAssets)).rejects.toThrow(
      'TreeSitter initialized with conflicting core WASM path'
    );
  });

  it('parallel calls share one initialization promise', async () => {
    const p1 = initTreeSitter(ASSETS);
    const p2 = initTreeSitter(ASSETS);
    expect(p1).toBe(p2); // they should be the exact same promise instance
    await Promise.all([p1, p2]);
  });

  it('language loads are cached by grammar WASM path', async () => {
    await initTreeSitter(ASSETS);
    const lang1 = await loadLanguage(TS_WASM);
    const lang2 = await loadLanguage(TS_WASM);
    expect(lang1).toBe(lang2); // identical instance
  });

  it('parallel grammar loads share one language-load promise', async () => {
    await initTreeSitter(ASSETS);
    const p1 = loadLanguage(TS_WASM);
    const p2 = loadLanguage(TS_WASM);
    expect(p1).toBe(p2); // same promise
    const [lang1, lang2] = await Promise.all([p1, p2]);
    expect(lang1).toBe(lang2);
  });

  it('first Parser.init rejection clears cached promise and retry succeeds', async () => {
    const initSpy = vi.spyOn(Parser, 'init');
    initSpy.mockRejectedValueOnce(new Error('init failed'));

    await expect(initTreeSitter(ASSETS)).rejects.toThrow('init failed');

    initSpy.mockRestore();
    await expect(initTreeSitter(ASSETS)).resolves.not.toThrow();
  });

  it('first Parser.Language.load rejection clears cached promise and retry succeeds', async () => {
    const loadSpy = vi.spyOn(Parser.Language, 'load');
    await initTreeSitter(ASSETS);
    loadSpy.mockRejectedValueOnce(new Error('load failed'));

    await expect(loadLanguage(TS_WASM)).rejects.toThrow('load failed');

    loadSpy.mockRestore();
    await expect(loadLanguage(TS_WASM)).resolves.toBeDefined();
  });
});
