/**
 * IPC handlers registration
 * Provides a clean separation of concerns for different IPC handler categories
 */

import { registerDialogHandlers } from './dialog';
import { registerRepositoryHandlers } from './repository';
import { registerScopeHandlers } from './scope';
import { registerIgnoreHandlers } from './ignore';
import { registerParsingHandlers } from './parsing';
import { registerApplyHandlers } from './apply';

export { registerDialogHandlers } from './dialog';
export { registerRepositoryHandlers } from './repository';
export { registerScopeHandlers } from './scope';
export { registerIgnoreHandlers } from './ignore';
export { registerParsingHandlers } from './parsing';
export { registerApplyHandlers } from './apply';

/**
 * Register all IPC handlers
 */
export function registerAllHandlers() {
  registerDialogHandlers();
  registerRepositoryHandlers();
  registerScopeHandlers();
  registerIgnoreHandlers();
  registerParsingHandlers();
  registerApplyHandlers();
}
