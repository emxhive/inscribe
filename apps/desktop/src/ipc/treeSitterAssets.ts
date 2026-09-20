import * as path from 'path';
import * as fs from 'fs';
import type { TreeSitterAssetPaths } from '@inscribe/engine';

export interface TreeSitterAssetDerivationOptions {
  devPaths?: Partial<TreeSitterAssetPaths>;
  prodPaths?: Partial<TreeSitterAssetPaths>;
  isPackaged?: boolean;
  resourcesPath?: string;
}

export function getTreeSitterAssetPaths(options?: TreeSitterAssetDerivationOptions): TreeSitterAssetPaths {
  const monorepoRoot = path.resolve(__dirname, '../../../..');

  const coreWasmCandidates = [
    path.resolve(monorepoRoot, 'packages/engine/node_modules/web-tree-sitter/tree-sitter.wasm'),
    path.resolve(monorepoRoot, 'node_modules/web-tree-sitter/tree-sitter.wasm'),
  ];
  const coreWasmPath = coreWasmCandidates.find((c) => fs.existsSync(c)) || coreWasmCandidates[0];

  const typescriptCandidates = [
    path.resolve(monorepoRoot, 'node_modules/tree-sitter-wasms/out/tree-sitter-typescript.wasm'),
    path.resolve(monorepoRoot, 'packages/engine/node_modules/tree-sitter-wasms/out/tree-sitter-typescript.wasm'),
  ];
  const typescriptGrammarPath = typescriptCandidates.find((c) => fs.existsSync(c)) || typescriptCandidates[0];

  const tsxCandidates = [
    path.resolve(monorepoRoot, 'node_modules/tree-sitter-wasms/out/tree-sitter-tsx.wasm'),
    path.resolve(monorepoRoot, 'packages/engine/node_modules/tree-sitter-wasms/out/tree-sitter-tsx.wasm'),
  ];
  const tsxGrammarPath = tsxCandidates.find((c) => fs.existsSync(c)) || tsxCandidates[0];

  const dartCandidates = [
    path.resolve(monorepoRoot, 'packages/engine/assets/tree-sitter-dart.wasm'),
    path.resolve(monorepoRoot, 'node_modules/tree-sitter-wasms/out/tree-sitter-dart.wasm'),
    path.resolve(monorepoRoot, 'packages/engine/node_modules/tree-sitter-wasms/out/tree-sitter-dart.wasm'),
  ];
  const dartGrammarPath = dartCandidates.find((c) => fs.existsSync(c)) || dartCandidates[0];

  const devPaths: TreeSitterAssetPaths = {
    coreWasmPath,
    languageWasmPaths: {
      typescript: typescriptGrammarPath,
      tsx: tsxGrammarPath,
      dart: dartGrammarPath,
    },
  };

  if (options?.devPaths) {
    Object.assign(devPaths, options.devPaths, {
      languageWasmPaths: {
        ...devPaths.languageWasmPaths,
        ...options.devPaths.languageWasmPaths,
      },
    });
  }

  // Packaged production app detection seam
  let isPackaged = options?.isPackaged;
  if (isPackaged === undefined) {
    try {
      const { app } = require('electron');
      if (app && app.isPackaged) {
        isPackaged = true;
      }
    } catch (e) {
      // Inside worker_threads, electron won't be available
    }
  }

  if (isPackaged) {
    const resourcesPath = options?.resourcesPath || (process as any).resourcesPath || '';
    const prodPaths: TreeSitterAssetPaths = {
      coreWasmPath: path.resolve(resourcesPath, 'tree-sitter.wasm'),
      languageWasmPaths: {
        typescript: path.resolve(resourcesPath, 'tree-sitter-typescript.wasm'),
        tsx: path.resolve(resourcesPath, 'tree-sitter-tsx.wasm'),
        dart: path.resolve(resourcesPath, 'tree-sitter-dart.wasm'),
      },
    };
    if (options?.prodPaths) {
      Object.assign(prodPaths, options.prodPaths, {
        languageWasmPaths: {
          ...prodPaths.languageWasmPaths,
          ...options.prodPaths.languageWasmPaths,
        },
      });
    }
    return prodPaths;
  }

  return devPaths;
}
