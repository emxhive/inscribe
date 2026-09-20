import { ipcMain } from 'electron';
import { requireTrustedRepoRoot } from './trustedRepo';
import { previewOnWorker } from './engineWorkerClient';
import { getTreeSitterAssetPaths } from './treeSitterAssets';
import type { PreviewWorkerResponse } from './previewTypes';

export function registerPreviewHandlers() {
  ipcMain.handle('preview', async (event, args: unknown): Promise<PreviewWorkerResponse> => {
    try {
      if (!args || typeof args !== 'object') {
        return {
          ok: false,
          errors: [
            {
              type: 'system',
              code: 'INVALID_IPC_INPUT',
              message: 'Arguments must be a valid object.',
            },
          ],
        };
      }

      const argsObj = args as Record<string, unknown>;
      const { repoRoot, rawInput } = argsObj;
      if (typeof repoRoot !== 'string' || typeof rawInput !== 'string') {
        return {
          ok: false,
          errors: [
            {
              type: 'system',
              code: 'INVALID_IPC_INPUT',
              message: 'repoRoot and rawInput must be strings.',
            },
          ],
        };
      }

      const trustedRepoRoot = requireTrustedRepoRoot(event, repoRoot);
      const assetPaths = getTreeSitterAssetPaths();

      // We explicitly ignore any extra renderer-supplied fields like assetPaths
      const payload = {
        trustedRepoRoot,
        rawInput,
        assetPaths,
      };

      return await previewOnWorker(payload);
    } catch (err: unknown) {
      return {
        ok: false,
        errors: [
          {
            type: 'system',
            code: 'UNEXPECTED_SYSTEM_ERROR',
            message: 'preview request failed.',
          },
        ],
      };
    }
  });
}
