import { ipcMain, BrowserWindow } from 'electron';
import { windowManager } from '../windowManager';
import { recentProjectsManager } from '../recentProjects';

/**
 * Register window-related IPC handlers
 */
export function registerWindowHandlers() {
  ipcMain.handle('open-repository', (event, repoRoot: string) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      windowManager.openRepo(repoRoot, win);
    }
    return null;
  });

  ipcMain.handle('get-window-repo', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    return win ? windowManager.getWindowRepo(win) : null;
  });

  ipcMain.handle('get-recent-projects', () => {
    return recentProjectsManager.getRecentProjects();
  });
}
