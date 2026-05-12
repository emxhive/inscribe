import { BrowserWindow, app, ipcMain } from 'electron';
import path from 'path';

export class WindowManager {
  private windows: Map<string, BrowserWindow> = new Map(); // normalized repoRoot -> BrowserWindow
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
      width: 1200,
      height: 800,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    const startUrl = isDev
      ? (devServerUrl ?? 'http://localhost:5173')
      : `file://${path.join(__dirname, 'renderer/index.html')}`;

    win.loadURL(startUrl);

    if (isDev) {
      win.webContents.openDevTools();
    }

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
    
    // If this repo is already open in another window, we might want to handle it.
    // But usually this is called when opening a new window or initializing an unbound one.
    const existingWin = this.windows.get(absoluteRepoRoot);
    if (existingWin && existingWin !== win) {
       // This shouldn't happen if we use openRepo consistently
       console.warn(`Repo ${absoluteRepoRoot} is already bound to another window.`);
    }

    this.windows.set(absoluteRepoRoot, win);
    this.windowToRepo.set(win, absoluteRepoRoot);
    this.unboundWindows.delete(win);
  }

  private handleWindowClosed(win: BrowserWindow) {
    this.unboundWindows.delete(win);
    const repoRoot = this.windowToRepo.get(win);
    if (repoRoot) {
      this.windows.delete(repoRoot);
      this.windowToRepo.delete(win);
    }
  }

  getWindowForRepo(repoRoot: string): BrowserWindow | undefined {
    return this.windows.get(path.resolve(repoRoot));
  }

  openRepo(repoRoot: string, fromWindow?: BrowserWindow) {
    const absoluteRepoRoot = path.resolve(repoRoot);
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
