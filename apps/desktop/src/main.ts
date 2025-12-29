import {app, BrowserWindow, dialog, ipcMain} from 'electron';
import path from 'path';
import {
  applyChanges,
  buildApplyPlan,
  indexRepository,
  parseBlocks,
  undoLastApply,
  validateBlocks,
} from '@inscribe/engine';
import {INDEXED_ROOTS} from '@inscribe/shared';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const isDev = process.env.NODE_ENV === 'development';
  const startUrl = isDev
    ? 'http://localhost:5173'
    : `file://${path.join(__dirname, '../renderer/index.html')}`;

  mainWindow.loadURL(startUrl);

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC Handlers
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

ipcMain.handle('index-repository', async (event, repoRoot: string) => {
  try {
    return indexRepository(repoRoot, Array.from(INDEXED_ROOTS));
  } catch (error) {
    console.error('Error indexing repository:', error);
    return [];
  }
});

ipcMain.handle('parse-blocks', async (event, content: string) => {
  try {
    return parseBlocks(content);
  } catch (error) {
    return {
      blocks: [],
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
});

ipcMain.handle('validate-blocks', async (event, blocks: any[], repoRoot: string) => {
  try {
    return validateBlocks(blocks, repoRoot);
  } catch (error) {
    return [
      {
        blockIndex: -1,
        file: '',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    ];
  }
});

ipcMain.handle('build-apply-plan', async (event, blocks: any[], repoRoot: string) => {
  try {
    // Validate first
    const validationErrors = validateBlocks(blocks, repoRoot);
    if (validationErrors.length > 0) {
      return { operations: [], errors: validationErrors };
    }

    // Build plan
    return buildApplyPlan(blocks);
  } catch (error) {
    return {
      operations: [],
      errors: [
        {
          blockIndex: -1,
          file: '',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      ],
    };
  }
});

ipcMain.handle('apply-changes', async (event, plan: any, repoRoot: string) => {
  try {
    return applyChanges(plan, repoRoot);
  } catch (error) {
    return {
      success: false,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
});

ipcMain.handle('undo-last-apply', async (event, repoRoot: string) => {
  try {
    return undoLastApply(repoRoot);
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
