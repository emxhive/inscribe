import { app } from 'electron';
import { registerAllHandlers } from './ipc';
import { windowManager } from './windowManager';
import { dispose as disposeEngineWorker } from './ipc/engineWorkerClient';
import './recentProjects';

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  // Register all IPC handlers only in the owning process.
  registerAllHandlers();

  let isReady = false;
  let pendingSecondInstances = 0;

  const createAndFocusWindow = () => {
    const win = windowManager.createWindow();
    if (win.isMinimized()) {
      win.restore();
    }
    win.focus();
  };

  app.on('second-instance', () => {
    if (!isReady) {
      pendingSecondInstances += 1;
      return;
    }

    createAndFocusWindow();
  });

  app.on('ready', () => {
    isReady = true;
    createAndFocusWindow();

    while (pendingSecondInstances > 0) {
      pendingSecondInstances -= 1;
      createAndFocusWindow();
    }
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
      createAndFocusWindow();
    }
  });
}
