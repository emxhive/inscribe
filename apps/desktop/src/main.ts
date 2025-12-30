import {app, BrowserWindow, dialog, ipcMain} from 'electron';
import path from 'path';
import {
  applyChanges,
  buildApplyPlan,
  computeDefaultScope,
  computeSuggestedExcludes,
  getIndexStatus,
  getOrCreateScope,
  indexRepository,
  listTopLevelFolders,
  parseBlocks,
  readIgnoreRules,
  setScopeState,
  undoLastApply,
  validateBlocks,
  writeIgnoreFile,
} from '@inscribe/engine';

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

  const isDev = !app.isPackaged;
  const startUrl = isDev
    ? 'http://localhost:5173'
    : `file://${path.join(__dirname, 'renderer/index.html')}`;

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

ipcMain.handle('repo-init', async (_event, repoRoot: string) => {
  try {
    const scopeState = getOrCreateScope(repoRoot);
    const topLevelFolders = listTopLevelFolders(repoRoot);
    const suggested = computeSuggestedExcludes(repoRoot);
    setScopeState(repoRoot, scopeState.scope, { lastSuggested: suggested });
    const ignore = readIgnoreRules(repoRoot);
    const indexedFiles = indexRepository(repoRoot);

    return {
      topLevelFolders,
      scope: scopeState.scope,
      ignore,
      suggested,
      indexedCount: indexedFiles.length,
      indexStatus: getIndexStatus(repoRoot),
    };
  } catch (error) {
    return {
      topLevelFolders: [],
      scope: [],
      ignore: { entries: [], source: 'none', path: '' },
      suggested: [],
      indexedCount: 0,
      indexStatus: {
        state: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
});

ipcMain.handle('get-scope', async (_event, repoRoot: string) => {
  try {
    return getOrCreateScope(repoRoot).scope;
  } catch {
    return [];
  }
});

ipcMain.handle('set-scope', async (_event, repoRoot: string, scope: string[]) => {
  try {
    const updated = setScopeState(repoRoot, scope);
    const indexedFiles = indexRepository(repoRoot, updated.scope);
    return {
      scope: updated.scope,
      indexedCount: indexedFiles.length,
      indexStatus: getIndexStatus(repoRoot),
    };
  } catch (error) {
    return {
      scope: [],
      indexedCount: 0,
      indexStatus: {
        state: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
});

ipcMain.handle('read-ignore', async (_event, repoRoot: string) => {
  try {
    return readIgnoreRules(repoRoot);
  } catch {
    return { entries: [], source: 'none', path: '' };
  }
});

ipcMain.handle('write-ignore', async (_event, repoRoot: string, content: string) => {
  const result = writeIgnoreFile(repoRoot, content);
  const suggested = computeSuggestedExcludes(repoRoot);
  const defaults = computeDefaultScope(repoRoot);
  const scopeState = getOrCreateScope(repoRoot);
  setScopeState(repoRoot, scopeState.scope, { lastSuggested: suggested });
  const indexedFiles = result.success ? indexRepository(repoRoot) : [];
  return {
    ...result,
    suggested,
    defaultScope: defaults.scope,
    topLevelFolders: defaults.topLevel,
    indexedCount: indexedFiles.length,
    indexStatus: getIndexStatus(repoRoot),
  };
});

ipcMain.handle('index-repository', async (event, repoRoot: string) => {
  try {
    const files = indexRepository(repoRoot);
    (files as any).indexedCount = files.length;
    (files as any).indexStatus = getIndexStatus(repoRoot);
    return files;
  } catch (error) {
    console.error('Error indexing repository:', error);
    return [];
  }
});

ipcMain.handle('index-status', async (_event, repoRoot: string) => {
  return getIndexStatus(repoRoot);
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
