import { app } from 'electron';
import { registerAllHandlers } from './ipc';
import { windowManager } from './windowManager';
import { dispose as disposeEngineWorker } from './ipc/engineWorkerClient';
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

app.on('will-quit', () => {
  disposeEngineWorker();
});

app.on('activate', () => {
  if (!windowManager.hasOpenWindows()) {
    windowManager.createWindow();
  }
});
