import { ipcMain } from 'electron';
import { requireTrustedRepoRoot } from './trustedRepo';
import { applyOnWorker } from './engineWorkerClient';
import type { ApplyWorkerResponse } from './applyTypes';

export function registerApplyHandlers() {
  ipcMain.handle('apply', async (event, args: unknown): Promise<ApplyWorkerResponse> => {
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

      return await applyOnWorker({
        trustedRepoRoot,
        previewToken,
      });
    } catch (err: unknown) {
      return {
        ok: false,
        errors: [{
          type: 'system',
          code: 'UNEXPECTED_SYSTEM_ERROR',
          message: 'apply request failed.',
        }],
      };
    }
  });
}
