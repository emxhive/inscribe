import { ipcMain } from 'electron';
import {
  parseBlocks,
  validateBlocks,
  buildApplyPlan,
} from '@inscribe/engine';

/**
 * Register parsing and validation IPC handlers
 */
export function registerParsingHandlers() {
  ipcMain.handle('parse-blocks', async (_event, content: string) => {
    try {
      return parseBlocks(content);
    } catch (error) {
      return {
        blocks: [],
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  });

  ipcMain.handle('validate-blocks', async (_event, blocks: any[], repoRoot: string) => {
    try {
      return validateBlocks(blocks, repoRoot);
    } catch (error) {
      return [
        {
          blockIndex: -1,
          file: '',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      ];
    }
  });

  ipcMain.handle('validate-and-build-apply-plan', async (_event, blocks: any[], repoRoot: string) => {
    try {
      // Validate first
      const validationErrors = validateBlocks(blocks, repoRoot);
      if (validationErrors.length > 0) {
        return { operations: [], errors: validationErrors };
      }

      // Build plan
      return buildApplyPlan(blocks);
    } catch (error) {
      return {
        operations: [],
        errors: [
          {
            blockIndex: -1,
            file: '',
            message: error instanceof Error ? error.message : 'Unknown error',
          },
        ],
      };
    }
  });
}
