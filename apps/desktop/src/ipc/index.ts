/**
 * IPC handlers registration
 * Provides a clean separation of concerns for different IPC handler categories
 */

import { registerDialogHandlers } from './dialog';
import { registerRepositoryHandlers } from './repository';
import { registerIgnoreHandlers } from './ignore';
import { registerParsingHandlers } from './parsing';
import { registerApplyHandlers } from './apply';
import { registerHistoryHandlers } from './history';
import { registerWindowHandlers } from './window';
import { registerTerminalHandlers } from './terminal';

export { registerDialogHandlers } from './dialog';
export { registerRepositoryHandlers } from './repository';
export { registerIgnoreHandlers } from './ignore';
export { registerParsingHandlers } from './parsing';
export { registerApplyHandlers } from './apply';
export { registerHistoryHandlers } from './history';
export { registerWindowHandlers } from './window';
export { registerTerminalHandlers } from './terminal';

/**
 * Register all IPC handlers
 */
export function registerAllHandlers() {
  registerDialogHandlers();
  registerRepositoryHandlers();
  registerIgnoreHandlers();
  registerParsingHandlers();
  registerApplyHandlers();
  registerHistoryHandlers();
  registerWindowHandlers();
  registerTerminalHandlers();
}
