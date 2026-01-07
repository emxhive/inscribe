import { ipcMain, dialog } from 'electron';

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
}
