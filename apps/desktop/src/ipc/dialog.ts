import { BrowserWindow, ipcMain, dialog } from 'electron';
import { readFile } from 'fs/promises';

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

  ipcMain.handle('select-markdown-file', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const result = win
      ? await dialog.showOpenDialog(win, {
        properties: ['openFile'],
        filters: [{ name: 'Markdown documents', extensions: ['md'] }],
      })
      : await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'Markdown documents', extensions: ['md'] }],
      });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return {
      path: result.filePaths[0],
      content: await readFile(result.filePaths[0], 'utf8'),
    };
  });
}
