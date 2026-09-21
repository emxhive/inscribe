import type { HistoryEntry } from '@inscribe/shared';
import type { ApplyErrorDTO } from '@/ipc/applyTypes';
import type { AppState } from '@/types';

type ApplySuccessOptions = {
  reviewItems: AppState['reviewItems'];
  previousHistoryItems: AppState['historyItems'];
  newHistoryItems: AppState['historyItems'];
  appliedActionId: string | null;
  appliedFileCount: number;
  terminalCommandSuggestions:
    AppState['terminalCommandSuggestions'];
};

export function buildApplyUnavailableUpdate(
  hasAppliedItems: boolean,
): Partial<AppState> {
  return {
    statusMessage: hasAppliedItems
      ? 'This preview has already been applied. Preview again to apply new changes.'
      : 'preview session is unavailable. Preview the changes again.',
  };
}

export function buildApplyStartedUpdate(
  reviewFileCount: number,
): Partial<AppState> {
  return {
    isApplyingInProgress: true,
    pipelineStatus: 'applying',
    statusMessage: `Applying preview (${reviewFileCount} file${
      reviewFileCount === 1 ? '' : 's'
    })...`,
  };
}

export function buildApplyFailureUpdate(
  errors: ApplyErrorDTO[],
): Partial<AppState> {
  return {
    previewSession: null,
    pipelineStatus: 'apply-failure',
    statusMessage: formatApplyErrors(errors),
  };
}

export function buildApplyRequestFailureUpdate(): Partial<AppState> {
  return {
    previewSession: null,
    pipelineStatus: 'apply-failure',
    statusMessage: 'Failed to apply preview.',
  };
}

export function buildApplySuccessUpdate({
  reviewItems,
  previousHistoryItems,
  newHistoryItems,
  appliedActionId,
  appliedFileCount,
  terminalCommandSuggestions,
}: ApplySuccessOptions): Partial<AppState> {
  return {
    reviewItems: reviewItems.map((item) => ({
      ...item,
      status: 'applied',
    })),
    historyItems: [
      ...newHistoryItems,
      ...previousHistoryItems,
    ],
    previewSession: null,
    lastAppliedActionId: appliedActionId,
    pipelineStatus: 'apply-success',
    statusMessage: `✓ Applied preview: ${appliedFileCount} file(s).`,
    ...(terminalCommandSuggestions.length > 0
      ? {
          terminalCommandSuggestions,
        }
      : {}),
  };
}

export function buildApplyFinishedUpdate(): Partial<AppState> {
  return {
    isApplyingInProgress: false,
  };
}

export function resolveAppliedActionId(
  historyEntries: HistoryEntry[] | undefined,
): string | null {
  return (
    historyEntries?.find(
      (entry) => entry.actionId,
    )?.actionId ??
    historyEntries?.[0]?.applyId ??
    null
  );
}

function formatApplyErrors(
  errors: ApplyErrorDTO[],
): string {
  return errors
    .map((error) =>
      error.filePath
        ? `${error.code} in ${error.filePath}: ${error.message}`
        : `${error.code}: ${error.message}`,
    )
    .join('; ');
}