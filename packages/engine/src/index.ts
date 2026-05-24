export { parseBlocks } from './parse/parseBlocks';
export { validateBlocks } from './contract/validateBlocks';
export { buildApplyPlan } from './plan/buildApplyPlan';
export { applyChanges } from './apply/applyChanges';
export { buildOperationComparison } from './preview/operationComparison';
export { buildOperationPreview } from './preview/operationPreview';

export {
  getScopeState,
  getOrCreateScope,
  setScopeState,
  getLastVisitedRepo,
} from './repo/scopeStore';
export {
  getEffectiveIgnoreMatchers,
} from './repo/ignoreRules';
export { listTopLevelFolders } from './repo/topLevel';
export { computeSuggestedExcludes, computeDefaultScope } from './repo/suggest';
export { indexRepository } from './repo/indexer';
export { getIndexStatus } from './repo/statusStore';
export {
  getHistoryEntries,
  appendHistoryEntries,
  markHistoryEntryRestored,
} from './repo/historyStore';
export {
  restoreFromPayload,
} from './history/restoreV2';
export {
  resolveRestoreExecution,
  type RestoreRequest,
} from './history/restoreExecution';
