import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  useAppStateContext,
  useHistoryActions,
  useParsingActions,
} from '@/hooks';
import { toSentenceCase } from '@/utils';
import type { PrimaryAction } from '@/utils/primaryAction';
import { getKeyboardShortcutDisplay } from '@/utils/keyboardShortcuts';
import { buildReviewExitUpdate } from '@/state/workflowTransitions';
import {
  selectCanReturnToPartialIntake,
  selectCanRevertLastAppliedAction,
  selectIsAppliedReview,
  selectIsHistoryReviewActive,
  selectIsParsingInProgress,
} from '@/state/workflowSelectors';

type WorkspaceBottomBarProps = {
  primaryAction: PrimaryAction;
  onRunPrimaryAction: () => void;
  onRevertChanges: () => void;
};

export function WorkspaceBottomBar({
  primaryAction,
  onRunPrimaryAction,
  onRevertChanges,
}: WorkspaceBottomBarProps) {
  const { state, updateState } =
    useAppStateContext();

  const { handleParseBlocks } =
    useParsingActions();

  const { closeHistoryReview } =
    useHistoryActions();

  const hasPartialPreview =
    primaryAction.id === 'review-partial';

  const isParsingInProgress =
    selectIsParsingInProgress(state);

  const canReturnToPartialIntake =
    selectCanReturnToPartialIntake(
      state,
    );

  const isHistoryReviewActive =
    selectIsHistoryReviewActive(state);

  const isAppliedReview =
    selectIsAppliedReview(state);

  const canRevertChanges =
    selectCanRevertLastAppliedAction(
      state,
    );

  const statusIcon = (() => {
    switch (state.pipelineStatus) {
      case 'parsing':
      case 'applying':
        return (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        );

      case 'parse-success':
      case 'apply-success':
        return (
          <CheckCircle2 className="h-3.5 w-3.5" />
        );

      case 'parse-partial':
        return (
          <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
        );

      case 'parse-failure':
      case 'apply-failure':
        return (
          <AlertCircle className="h-3.5 w-3.5 text-destructive" />
        );

      default:
        if (
          state.indexStatus.state ===
          'error'
        ) {
          return (
            <AlertCircle className="h-3.5 w-3.5 text-destructive" />
          );
        }

        return null;
    }
  })();

  const statusText =
    state.statusMessage ||
    toSentenceCase(
      state.indexStatus.state,
    );

  const restoreUnavailableTitle =
    !primaryAction.enabled &&
    primaryAction.label ===
      'Restore unavailable'
      ? 'Restore is unavailable for the current repository state'
      : undefined;

  return (
    <footer className="flex h-10 flex-shrink-0 items-center gap-2 border-t border-border bg-card px-3">
      <div className="flex min-w-0 flex-1 items-center gap-2 text-xs text-muted-foreground">
        {statusIcon}

        <span
          className="truncate"
          title={statusText}
        >
          {statusText}
        </span>
      </div>

      {isHistoryReviewActive && (
        <>
          <Button
            variant="outline"
            type="button"
            size="sm"
            onClick={closeHistoryReview}
            disabled={
              state.isRestoringInProgress
            }
          >
            Back to History
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={onRunPrimaryAction}
            disabled={!primaryAction.enabled}
            title={
              restoreUnavailableTitle
            }
          >
            <PrimaryActionButtonLabel
              label={primaryAction.label}
            />
          </Button>
        </>
      )}

      {!isHistoryReviewActive &&
        state.mode === 'intake' && (
          <>
            {hasPartialPreview && (
              <Button
                variant="default"
                type="button"
                size="sm"
                onClick={
                  onRunPrimaryAction
                }
                disabled={
                  !primaryAction.enabled
                }
              >
                <PrimaryActionButtonLabel
                  label={
                    primaryAction.label
                  }
                />
              </Button>
            )}

            <Button
              variant={
                primaryAction.id ===
                'parse'
                  ? 'default'
                  : 'outline'
              }
              type="button"
              size="sm"
              onClick={
                primaryAction.id ===
                'parse'
                  ? onRunPrimaryAction
                  : handleParseBlocks
              }
              disabled={
                primaryAction.id ===
                'parse'
                  ? !primaryAction.enabled
                  : !state.repoRoot ||
                    isParsingInProgress
              }
              title={
                primaryAction.id ===
                  'parse' &&
                !state.repoRoot
                  ? 'Select a repository first'
                  : primaryAction.id ===
                        'parse' &&
                      isParsingInProgress
                    ? 'Parsing in progress...'
                    : ''
              }
            >
              {primaryAction.id ===
              'parse' ? (
                <PrimaryActionButtonLabel
                  label={
                    primaryAction.label
                  }
                />
              ) : (
                'Parse Code Blocks'
              )}
            </Button>
          </>
        )}

      {!isHistoryReviewActive &&
        state.mode === 'review' && (
          <>
            {canReturnToPartialIntake && (
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() =>
                  updateState({
                    ...buildReviewExitUpdate(),
                    pipelineStatus:
                      'parse-partial',
                    statusMessage:
                      'Partial preview preserved. Select Review valid blocks to return.',
                  })
                }
              >
                Back to Intake
              </Button>
            )}

            <span className="text-xs text-muted-foreground">
              N / Shift+N navigates hunks
            </span>

            {!isAppliedReview && (
              <Button
                type="button"
                size="sm"
                onClick={
                  onRunPrimaryAction
                }
                disabled={
                  !primaryAction.enabled
                }
              >
                <PrimaryActionButtonLabel
                  label={
                    primaryAction.label
                  }
                />
              </Button>
            )}

            {isAppliedReview && (
              <>
                {state.lastAppliedActionId && (
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={
                      onRevertChanges
                    }
                    disabled={
                      !canRevertChanges
                    }
                  >
                    <span className="flex min-w-0 items-baseline gap-1">
                      <span className="truncate">
                        Revert changes
                      </span>

                      <kbd className="shrink-0 rounded border border-border bg-secondary px-1.5 py-0.5 font-mono text-[9px] font-medium leading-none tracking-tight text-muted-foreground">
                        {getKeyboardShortcutDisplay(
                          'revert-changes',
                        )}
                      </kbd>
                    </span>
                  </Button>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  disabled={
                    state.isRestoringInProgress
                  }
                  onClick={() =>
                    updateState(
                      buildReviewExitUpdate(),
                    )
                  }
                >
                  Back to Intake
                </Button>

                <Button
                  size="sm"
                  type="button"
                  disabled
                  className="min-w-[9rem]"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Applied
                </Button>
              </>
            )}
          </>
        )}
    </footer>
  );
}

function PrimaryActionButtonLabel({
  label,
}: {
  label: string;
}) {
  return (
    <span className="flex min-w-0 items-baseline gap-1">
      <span className="truncate">
        {label}
      </span>

      <kbd className="shrink-0 rounded border border-primary-foreground/20 bg-primary-foreground/10 px-1.5 py-0.5 font-mono text-[9px] font-medium leading-none tracking-tight text-primary-foreground/70">
        {getKeyboardShortcutDisplay(
          'primary-action',
        )}
      </kbd>
    </span>
  );
}