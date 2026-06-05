import { clipboard, ipcMain } from 'electron';

export function registerClipboardHandlers() {
  ipcMain.handle('clipboard-read-text', () => clipboard.readText());
}
