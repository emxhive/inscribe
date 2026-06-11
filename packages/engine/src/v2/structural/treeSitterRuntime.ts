import Parser from 'web-tree-sitter';

export interface TreeSitterAssetPaths {
  coreWasmPath: string;
  typescriptWasmPath: string;
  tsxWasmPath: string;
}

let initPromise: Promise<void> | null = null;
let initializedCoreWasmPath: string | null = null;
const languageLoadPromises = new Map<string, Promise<Parser.Language>>();

export function initTreeSitter(paths: TreeSitterAssetPaths): Promise<void> {
  if (initPromise) {
    if (initializedCoreWasmPath !== paths.coreWasmPath) {
      return Promise.reject(
        new Error(`TreeSitter initialized with conflicting core WASM path. Initial: ${initializedCoreWasmPath}, Requested: ${paths.coreWasmPath}`)
      );
    }
    return initPromise;
  }

  initializedCoreWasmPath = paths.coreWasmPath;
  const promise = Parser.init({
    locateFile(scriptName: string) {
      if (scriptName === 'tree-sitter.wasm') {
        return paths.coreWasmPath;
      }
      return scriptName;
    },
  });

  initPromise = promise;

  promise.catch(() => {
    if (initPromise === promise) {
      initPromise = null;
      initializedCoreWasmPath = null;
    }
  });

  return promise;
}

export function loadLanguage(wasmPath: string): Promise<Parser.Language> {
  let promise = languageLoadPromises.get(wasmPath);
  if (!promise) {
    promise = Parser.Language.load(wasmPath);
    languageLoadPromises.set(wasmPath, promise);

    promise.catch(() => {
      if (languageLoadPromises.get(wasmPath) === promise) {
        languageLoadPromises.delete(wasmPath);
      }
    });
  }
  return promise;
}

export function createParser(): Parser {
  return new Parser();
}

export function resetRuntimeForTesting(): void {
  initPromise = null;
  initializedCoreWasmPath = null;
  languageLoadPromises.clear();
}
