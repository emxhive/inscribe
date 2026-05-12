import { app, BrowserWindow, ipcMain } from 'electron';
import { registerAllHandlers } from './ipc';
import { windowManager } from './windowManager';
import './recentProjects';

// Register all IPC handlers
registerAllHandlers();

app.on('ready', () => {
  windowManager.createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (!windowManager.hasOpenWindows()) {
    windowManager.createWindow();
  }
});

// Handle repo opening from renderer
ipcMain.on('claim-repo', (event, repoRoot: string) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    windowManager.bindWindowToRepo(win, repoRoot);
  }
});
