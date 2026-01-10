import { ipcMain } from 'electron';
import {
  parseBlocks,
  validateBlocks,
  buildApplyPlan,
} from '@engine';
import type { ApplyPlan, ParsedBlock, ValidationError } from '@shared';

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

  ipcMain.handle('validate-blocks', async (_event, blocks: ParsedBlock[], repoRoot: string) => {
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

  ipcMain.handle('validate-and-build-apply-plan', async (_event, blocks: ParsedBlock[], repoRoot: string) => {
    try {
      // Validate first
      const validationErrors: ValidationError[] = validateBlocks(blocks, repoRoot);
      if (validationErrors.length > 0) {
        const plan: ApplyPlan = { operations: [], errors: validationErrors };
        return plan;
      }

      // Build plan
      return buildApplyPlan(blocks);
    } catch (error) {
      const plan: ApplyPlan = {
        operations: [],
        errors: [
          {
            blockIndex: -1,
            file: '',
            message: error instanceof Error ? error.message : 'Unknown error',
          },
        ],
      };
      return plan;
    }
  });
}
