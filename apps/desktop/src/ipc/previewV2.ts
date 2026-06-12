import { ipcMain } from 'electron';
import { requireTrustedRepoRoot } from './trustedRepo';
import { previewV2OnWorker } from './engineWorkerClient';
import { getTreeSitterAssetPaths } from './treeSitterAssets';
import type { PreviewV2WorkerResponse } from './previewV2Types';

export function registerPreviewV2Handlers() {
  ipcMain.handle('preview-v2', async (event, args: unknown): Promise<PreviewV2WorkerResponse> => {
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

      return await previewV2OnWorker(payload);
    } catch (err: unknown) {
      return {
        ok: false,
        errors: [
          {
            type: 'system',
            code: 'UNEXPECTED_SYSTEM_ERROR',
            message: 'V2 preview request failed.',
          },
        ],
      };
    }
  });
}
