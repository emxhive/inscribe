import { getReviewApplySummary } from './review';
import type { AppState } from '@/types';

export type PrimaryActionId = 'parse' | 'review-v2-partial' | 'apply-all';

export interface PrimaryAction {
  id: PrimaryActionId;
  label: string;
  enabled: boolean;
}

type PrimaryActionState = Pick<
  AppState,
  | 'mode'
  | 'repoRoot'
  | 'isParsingInProgress'
  | 'isApplyingInProgress'
  | 'v2ReviewFiles'
  | 'reviewItems'
  | 'reviewPreflightByItem'
  | 'v2PreviewSession'
  | 'v2PreviewDiagnostics'
  | 'pipelineStatus'
>;

export function resolvePrimaryAction(state: PrimaryActionState): PrimaryAction {
  if (state.mode === 'intake') {
    const hasPartialV2Preview =
      state.pipelineStatus === 'parse-partial' &&
      Boolean(state.v2PreviewSession) &&
      state.v2ReviewFiles.length > 0;

    if (hasPartialV2Preview) {
      const excludedV2BlockCount = new Set(
        state.v2PreviewDiagnostics.map((diagnostic) => diagnostic.blockIndex ?? `global:${diagnostic.code}:${diagnostic.line ?? ''}`),
      ).size;
      const excludedLabel = `${excludedV2BlockCount} Excluded`;

      return {
        id: 'review-v2-partial',
        label: `Review ${state.v2ReviewFiles.length} Files · ${excludedLabel}`,
        enabled: !state.isParsingInProgress && !state.isApplyingInProgress,
      };
    }

    return {
      id: 'parse',
      label: state.isParsingInProgress ? 'Parsing...' : 'Parse Code Blocks',
      enabled: Boolean(state.repoRoot) && !state.isParsingInProgress,
    };
  }

  const hasOnlyPendingV2Items =
    state.v2ReviewFiles.length > 0 &&
    state.reviewItems.length > 0 &&
    state.reviewItems.every((item) => item.engineVersion === 'v2' && item.status === 'pending');
  const canApplyV2Session =
    Boolean(state.repoRoot) &&
    Boolean(state.v2PreviewSession) &&
    hasOnlyPendingV2Items;
  const applySummary = getReviewApplySummary(state.reviewItems, state.reviewPreflightByItem);

  return {
    id: 'apply-all',
    label: canApplyV2Session ? 'Apply V2 Preview' : 'Apply All',
    enabled: (applySummary.canApplyAll || canApplyV2Session) && !state.isApplyingInProgress,
  };
}
