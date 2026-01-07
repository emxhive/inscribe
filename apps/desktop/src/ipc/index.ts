/**
 * IPC handlers registration
 * Provides a clean separation of concerns for different IPC handler categories
 */

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
  const { registerDialogHandlers } = require('./dialog');
  const { registerRepositoryHandlers } = require('./repository');
  const { registerScopeHandlers } = require('./scope');
  const { registerIgnoreHandlers } = require('./ignore');
  const { registerParsingHandlers } = require('./parsing');
  const { registerApplyHandlers } = require('./apply');

  registerDialogHandlers();
  registerRepositoryHandlers();
  registerScopeHandlers();
  registerIgnoreHandlers();
  registerParsingHandlers();
  registerApplyHandlers();
}
