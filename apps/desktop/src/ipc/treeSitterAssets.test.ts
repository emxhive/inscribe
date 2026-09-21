import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { getTreeSitterAssetPaths } from './treeSitterAssets';

describe('Tree-sitter Asset Locator', () => {
  it('returns valid dev asset paths and verifies they exist on the filesystem', () => {
    const assets = getTreeSitterAssetPaths();
    expect(fs.existsSync(assets.coreWasmPath)).toBe(true);
    expect(fs.existsSync(assets.languageWasmPaths.typescript)).toBe(true);
    expect(fs.existsSync(assets.languageWasmPaths.tsx)).toBe(true);
    expect(fs.existsSync(assets.languageWasmPaths.dart)).toBe(true);
  });

  it('packaged seam derives from injected resourcesPath', () => {
    const paths = getTreeSitterAssetPaths({
      isPackaged: true,
      resourcesPath: '/packaged/resources',
    });
    expect(paths.coreWasmPath).toBe(path.resolve('/packaged/resources', 'tree-sitter.wasm'));
    expect(paths.languageWasmPaths.dart).toBe(path.resolve('/packaged/resources', 'tree-sitter-dart.wasm'));
  });
});
