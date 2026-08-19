/**
 * Utility functions for the desktop app
 * Organized by concern for better maintainability
 */

export { getLanguageFromFilename } from './language';
export { normalizePath, getPathBasename } from './path';
export { getRepoDisplayName, getWindowTitle } from './windowTitle';
export { countLines, toSentenceCase } from './text';
export {
  buildReviewItems,
  buildApplyPlanFromItems,
  buildReviewItemPreflightFingerprint,
  getApplyablePendingReviewItems,
  getBlockedReviewItems,
  getCurrentReviewPreflight,
  getReviewApplySummary,
  getReviewItemApplyState,
  getReviewSidebarError,
  getReviewSidebarStatus,
  getUnresolvedPreflightReviewItems,
  summarizeSkippedReviewItems,
  V2_APPLY_BLOCKER,
} from './review';
export { decorateHistoryEntries } from './history';
export { prepareInscribeInput } from './prepareInscribeInput';
export { parseLiveIntakeStructure, type LiveIntakeStructure } from './liveIntake';
export { scanV2IntakeStructure } from './intakeV2';
export {
  attributeV2PreviewDiagnostics,
  findV2DiagnosticBlock,
  type AttributedV2IntakeStructure,
} from './v2IntakeDiagnostics';
export { detectInscribeProtocol } from './detectInscribeProtocol';
export { removeIntakeBlockFromText } from './intakeEditing';
