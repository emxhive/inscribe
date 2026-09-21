import Parser from 'web-tree-sitter';

export interface TreeSitterAssetPaths {
  coreWasmPath: string;
  /** Generic grammar id to WASM path mapping used by language adapters. */
  languageWasmPaths: Readonly<Record<string, string>>;
}

export type TreeSitterRuntimeAssets = TreeSitterAssetPaths;

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

/**
 * Resolves a grammar asset by its language id rather than by a language-
 * specific property on the runtime configuration.
 */
export function resolveGrammarWasmPath(
  assets: TreeSitterAssetPaths,
  grammarId: string,
): string {
  const genericPath = assets.languageWasmPaths[grammarId];
  if (genericPath) {
    return genericPath;
  }

  throw new Error(`Missing Tree-sitter grammar asset: ${grammarId}`);
}

export function loadLanguageForGrammar(
  assets: TreeSitterAssetPaths,
  grammarId: string,
): Promise<Parser.Language> {
  return loadLanguage(resolveGrammarWasmPath(assets, grammarId));
}

export function createParser(): Parser {
  return new Parser();
}

export function resetRuntimeForTesting(): void {
  initPromise = null;
  initializedCoreWasmPath = null;
  languageLoadPromises.clear();
}
