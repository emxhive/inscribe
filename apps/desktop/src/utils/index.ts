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
