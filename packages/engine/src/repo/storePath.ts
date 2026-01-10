import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { SCOPE_STORE_FILE, INSCRIBE_DIR } from '@shared';

export function getUserDataPath(): string {
  if (process.env.INSCRIBE_USER_DATA) {
    return process.env.INSCRIBE_USER_DATA;
  }

  try {
    const electron = require('electron') as typeof import('electron');
    if (electron?.app?.getPath) {
      return electron.app.getPath('userData');
    }
  } catch {
    // Ignore if electron is not available (e.g., during tests)
  }

  return path.join(os.tmpdir(), 'inscribe-user-data');
}

export function getStorePath(): string {
  const baseDir = path.join(getUserDataPath(), INSCRIBE_DIR);
  fs.mkdirSync(baseDir, { recursive: true });
  return path.join(baseDir, SCOPE_STORE_FILE);
}
