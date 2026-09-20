/**
 * IPC handlers registration
 * Provides a clean separation of concerns for different IPC handler categories
 */

import { registerDialogHandlers } from './dialog';
import { registerRepositoryHandlers } from './repository';
import { registerIgnoreHandlers } from './ignore';
import { registerHistoryHandlers } from './history';
import { registerWindowHandlers } from './window';
import { registerTerminalHandlers } from './terminal';
import { registerClipboardHandlers } from './clipboard';
import { registerPreviewHandlers } from './preview';
import { registerApplyHandlers } from './apply';

export { registerDialogHandlers } from './dialog';
export { registerRepositoryHandlers } from './repository';
export { registerIgnoreHandlers } from './ignore';
export { registerHistoryHandlers } from './history';
export { registerWindowHandlers } from './window';
export { registerTerminalHandlers } from './terminal';
export { registerClipboardHandlers } from './clipboard';
export { registerPreviewHandlers } from './preview';
export { registerApplyHandlers } from './apply';

/**
 * Register all IPC handlers
 */
export function registerAllHandlers() {
  registerDialogHandlers();
  registerRepositoryHandlers();
  registerIgnoreHandlers();
  registerHistoryHandlers();
  registerWindowHandlers();
  registerTerminalHandlers();
  registerClipboardHandlers();
  registerPreviewHandlers();
  registerApplyHandlers();
}
