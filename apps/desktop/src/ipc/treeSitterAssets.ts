import * as path from 'path';
import * as fs from 'fs';
import type { v2 } from '@inscribe/engine';

export interface TreeSitterAssetDerivationOptions {
  devPaths?: Partial<v2.TreeSitterAssetPaths>;
  prodPaths?: Partial<v2.TreeSitterAssetPaths>;
  isPackaged?: boolean;
  resourcesPath?: string;
}

export function getTreeSitterAssetPaths(options?: TreeSitterAssetDerivationOptions): v2.TreeSitterAssetPaths {
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
  const typescriptWasmPath = typescriptCandidates.find((c) => fs.existsSync(c)) || typescriptCandidates[0];

  const tsxCandidates = [
    path.resolve(monorepoRoot, 'node_modules/tree-sitter-wasms/out/tree-sitter-tsx.wasm'),
    path.resolve(monorepoRoot, 'packages/engine/node_modules/tree-sitter-wasms/out/tree-sitter-tsx.wasm'),
  ];
  const tsxWasmPath = tsxCandidates.find((c) => fs.existsSync(c)) || tsxCandidates[0];

  const devPaths: v2.TreeSitterAssetPaths = {
    coreWasmPath,
    typescriptWasmPath,
    tsxWasmPath,
  };

  if (options?.devPaths) {
    Object.assign(devPaths, options.devPaths);
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
    const prodPaths: v2.TreeSitterAssetPaths = {
      coreWasmPath: path.resolve(resourcesPath, 'tree-sitter.wasm'),
      typescriptWasmPath: path.resolve(resourcesPath, 'tree-sitter-typescript.wasm'),
      tsxWasmPath: path.resolve(resourcesPath, 'tree-sitter-tsx.wasm'),
    };
    if (options?.prodPaths) {
      Object.assign(prodPaths, options.prodPaths);
    }
    return prodPaths;
  }

  return devPaths;
}
