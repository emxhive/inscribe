export { parseBlocks } from './parse/parseBlocks';
export { validateBlocks } from './contract/validateBlocks';
export { buildApplyPlan } from './plan/buildApplyPlan';
export { applyChanges } from './apply/applyChanges';
export {
  applyPreparedFileMutations,
  PreparedFileMutation,
  PreparedMutationApplyErrorCode,
  PreparedMutationApplyResult,
} from './apply/applyPreparedFileMutations';
export { buildOperationComparison } from './preview/operationComparison';
export { buildOperationPreview } from './preview/operationPreview';

export {
  readIgnoreRules,
  writeIgnoreFile,
  getEffectiveIgnorePrefixes,
  getEffectiveIgnoreMatchers,
} from './repo/ignoreRules';
export { listTopLevelFolders } from './repo/topLevel';
export { computeSuggestedExcludes } from './repo/suggest';
export { indexRepository } from './repo/indexer';
export { getIndexStatus } from './repo/statusStore';
export {
  getHistoryEntries,
  appendHistoryEntries,
  markHistoryEntryRestored,
} from './repo/historyStore';
export {
  getAppliedAiInputRecord,
  hashAppliedAiInput,
  normalizeAppliedAiInput,
  recordAppliedAiInput,
} from './repo/appliedInputStore';
export {
  restoreFromPayload,
} from './history/restoreV2';
export {
  resolveRestoreExecution,
  type RestoreRequest,
} from './history/restoreExecution';
export { restoreEntry } from './history/restoreEntry';
export {
  previewV2RestoreAction,
  restoreV2Action,
} from './history/v2HistoryRestore';

export * as v2 from './v2';
