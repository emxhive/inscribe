import * as os from 'os';
import * as path from 'path';

type ElectronRuntime = {
  app?: {
    getPath(name: 'userData'): string;
  };
};

export function getUserDataPath(): string {
  if (process.env.INSCRIBE_USER_DATA) {
    return process.env.INSCRIBE_USER_DATA;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const electron = require('electron') as ElectronRuntime;
    if (electron?.app?.getPath) {
      return electron.app.getPath('userData');
    }
  } catch {
    // Ignore if electron is not available, such as during engine tests.
  }

  return path.join(os.tmpdir(), 'inscribe-user-data');
}
