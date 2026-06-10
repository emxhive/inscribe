import Parser from 'web-tree-sitter';

export interface TreeSitterAssetPaths {
  coreWasmPath: string;
  typescriptWasmPath: string;
  tsxWasmPath: string;
}

let isInitialized = false;

export async function initTreeSitter(paths: TreeSitterAssetPaths): Promise<void> {
  if (isInitialized) {
    return;
  }
  await Parser.init({
    locateFile(scriptName: string) {
      if (scriptName === 'tree-sitter.wasm') {
        return paths.coreWasmPath;
      }
      return scriptName;
    },
  });
  isInitialized = true;
}

export async function loadLanguage(wasmPath: string): Promise<Parser.Language> {
  return await Parser.Language.load(wasmPath);
}

export function createParser(): Parser {
  return new Parser();
}
