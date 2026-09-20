/**
 * Utility functions for the desktop app
 * Organized by concern for better maintainability
 */

export { getLanguageFromFilename } from './language';
export { normalizePath, getPathBasename } from './path';
export { getRepoDisplayName, getWindowTitle } from './windowTitle';
export { countLines, toSentenceCase } from './text';
export { decorateHistoryEntries } from './history';
export { parseLiveIntakeStructure, type LiveIntakeStructure } from './liveIntake';
export { scanIntakeStructure } from './intakeParser';
export {
  attributePreviewDiagnostics,
  findDiagnosticBlock,
  type AttributedIntakeStructure,
} from './intakeDiagnostics';
export { removeIntakeBlockFromText } from './intakeEditing';
