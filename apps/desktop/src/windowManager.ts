import { BrowserWindow, app, ipcMain } from 'electron';
import path from 'path';
import { getWindowTitle } from './utils/windowTitle';

export class WindowManager {
  private windows: Map<string, Set<BrowserWindow>> = new Map(); // normalized repoRoot -> BrowserWindows
  private unboundWindows: Set<BrowserWindow> = new Set();
  private windowToRepo: Map<BrowserWindow, string> = new Map();

  constructor() {}

  public getWindowRepo(win: BrowserWindow): string | undefined {
    return this.windowToRepo.get(win);
  }

  createWindow(repoRoot?: string): BrowserWindow {
    const isDev = !app.isPackaged;
    const devServerUrl = process.env.VITE_DEV_SERVER_URL || process.env.ELECTRON_RENDERER_URL;
    
    // In production, __dirname is where main.js is. renderer/index.html is relative to it.
    // Based on main.ts: const startUrl = isDev ? ... : `file://${path.join(__dirname, 'renderer/index.html')}`;
    
    const win = new BrowserWindow({
      title: getWindowTitle(repoRoot),
      width: 1200,
      height: 800,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    const startUrl = isDev
      ? (devServerUrl ?? 'http://127.0.0.1:5173')
      : `file://${path.join(__dirname, 'renderer/index.html')}`;

    win.loadURL(startUrl);
    //
    // if (isDev) {
    //   win.webContents.openDevTools();
    // }

    if (repoRoot) {
      this.bindWindowToRepo(win, repoRoot);
    } else {
      this.unboundWindows.add(win);
    }

    win.on('closed', () => {
      this.handleWindowClosed(win);
    });

    return win;
  }

  public bindWindowToRepo(win: BrowserWindow, repoRoot: string) {
    const absoluteRepoRoot = path.resolve(repoRoot);

    const previousRepoRoot = this.windowToRepo.get(win);
    if (previousRepoRoot) {
      const previousWindows = this.windows.get(previousRepoRoot);
      previousWindows?.delete(win);
      if (previousWindows?.size === 0) {
        this.windows.delete(previousRepoRoot);
      }
    }

    const repoWindows = this.windows.get(absoluteRepoRoot) ?? new Set<BrowserWindow>();
    repoWindows.add(win);
    this.windows.set(absoluteRepoRoot, repoWindows);
    this.windowToRepo.set(win, absoluteRepoRoot);
    win.setTitle(getWindowTitle(absoluteRepoRoot));
    this.unboundWindows.delete(win);
  }

  private handleWindowClosed(win: BrowserWindow) {
    this.unboundWindows.delete(win);
    const repoRoot = this.windowToRepo.get(win);
    if (repoRoot) {
      const repoWindows = this.windows.get(repoRoot);
      repoWindows?.delete(win);
      if (repoWindows?.size === 0) {
        this.windows.delete(repoRoot);
      }
      this.windowToRepo.delete(win);
    }
  }

  getWindowForRepo(repoRoot: string): BrowserWindow | undefined {
    const repoWindows = this.windows.get(path.resolve(repoRoot));
    if (!repoWindows) {
      return undefined;
    }

    for (const win of repoWindows) {
      if (!win.isDestroyed()) {
        return win;
      }
    }

    return undefined;
  }

  openRepo(repoRoot: string, fromWindow?: BrowserWindow, target: 'auto' | 'same-window' | 'new-window' = 'auto') {
    const absoluteRepoRoot = path.resolve(repoRoot);

    if (target === 'new-window') {
      return this.createWindow(absoluteRepoRoot);
    }

    if (target === 'same-window' && fromWindow) {
      this.bindWindowToRepo(fromWindow, absoluteRepoRoot);
      fromWindow.webContents.send('open-repo', absoluteRepoRoot);
      fromWindow.focus();
      return fromWindow;
    }

    const existingWin = this.getWindowForRepo(absoluteRepoRoot);

    if (existingWin) {
      existingWin.focus();
      return existingWin;
    }

    // If we are coming from an unbound window, use it.
    if (fromWindow && this.unboundWindows.has(fromWindow)) {
      this.bindWindowToRepo(fromWindow, absoluteRepoRoot);
      fromWindow.webContents.send('open-repo', absoluteRepoRoot);
      return fromWindow;
    }

    // Otherwise create a new window
    return this.createWindow(absoluteRepoRoot);
  }
  
  hasOpenWindows(): boolean {
    return this.windows.size > 0 || this.unboundWindows.size > 0;
  }
}

export const windowManager = new WindowManager();
