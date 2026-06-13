import { ipcMain } from 'electron';
import { requireTrustedRepoRoot } from './trustedRepo';
import { applyV2OnWorker } from './engineWorkerClient';
import type { ApplyV2WorkerResponse } from './applyV2Types';

export function registerApplyV2Handlers() {
  ipcMain.handle('apply-v2', async (event, args: unknown): Promise<ApplyV2WorkerResponse> => {
    try {
      if (!args || typeof args !== 'object') {
        return {
          ok: false,
          errors: [{
            type: 'system',
            code: 'INVALID_IPC_INPUT',
            message: 'repoRoot and previewToken must be valid strings.',
          }],
        };
      }

      const argsObj = args as Record<string, unknown>;
      const { repoRoot, previewToken } = argsObj;

      if (
        typeof repoRoot !== 'string' ||
        repoRoot.trim().length === 0 ||
        typeof previewToken !== 'string' ||
        previewToken.trim().length === 0
      ) {
        return {
          ok: false,
          errors: [{
            type: 'system',
            code: 'INVALID_IPC_INPUT',
            message: 'repoRoot and previewToken must be valid strings.',
          }],
        };
      }

      const trustedRepoRoot = requireTrustedRepoRoot(event, repoRoot);

      return await applyV2OnWorker({
        trustedRepoRoot,
        previewToken,
      });
    } catch (err: unknown) {
      return {
        ok: false,
        errors: [{
          type: 'system',
          code: 'UNEXPECTED_SYSTEM_ERROR',
          message: 'V2 apply request failed.',
        }],
      };
    }
  });
}
