import { BrowserWindow, ipcMain, dialog } from 'electron';
import type { AppliedAiInputRecord } from '@inscribe/shared';

function formatAppliedAt(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString();
}

/**
 * Register dialog-related IPC handlers
 */
export function registerDialogHandlers() {
  ipcMain.handle('select-repository', async (_event, defaultPath?: string) => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      defaultPath,
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  });

  ipcMain.handle('confirm-previously-applied-ai-input-parse', async (event, record: AppliedAiInputRecord) => {
    const options = {
      type: 'warning' as const,
      buttons: ['Cancel', 'Parse Anyway'],
      defaultId: 0,
      cancelId: 0,
      title: 'AI input already applied',
      message: 'This AI input was already applied to this repository.',
      detail: [
        `First applied: ${formatAppliedAt(record.firstAppliedAt)}`,
        `Last applied: ${formatAppliedAt(record.lastAppliedAt)}`,
        `Times applied: ${record.timesApplied}`,
        `Last applied blocks: ${record.appliedBlockCount}`,
        '',
        'Parse it again anyway?',
      ].join('\n'),
    };
    const win = BrowserWindow.fromWebContents(event.sender);
    const result = win
      ? await dialog.showMessageBox(win, options)
      : await dialog.showMessageBox(options);
    return result.response === 1;
  });
}
