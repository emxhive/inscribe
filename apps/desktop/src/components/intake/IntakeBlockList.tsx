import { useEffect } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CircleDot,
  XCircle,
} from 'lucide-react';
import { EmptyState } from '@/components/common';
import {
  useAppStateContext,
  useIntakeBlocks,
} from '@/hooks';
import { cn } from '@/lib/utils';

const intakeStatusConfig = {
  valid: {
    icon: CheckCircle2,
    className: 'text-emerald-600',
    label: 'valid',
  },
  warning: {
    icon: AlertTriangle,
    className: 'text-amber-600',
    label: 'warning',
  },
  error: {
    icon: XCircle,
    className: 'text-destructive',
    label: 'error',
  },
  incomplete: {
    icon: CircleDot,
    className: 'text-amber-500 animate-pulse',
    label: 'incomplete',
  },
} as const;

export function IntakeBlockList() {
  const { state, updateState } = useAppStateContext();
  const { blocks } = useIntakeBlocks();

  const invalidBlockCount = blocks.filter(
    (block) =>
      block.status === 'error' ||
      block.status === 'incomplete',
  ).length;

  const intakeIssueCount = blocks.reduce(
    (sum, block) =>
      sum +
      new Set([
        ...block.errors,
        ...block.warnings,
      ]).size,
    0,
  );

  useEffect(() => {
    if (state.mode !== 'intake') {
      return;
    }

    if (
      blocks.length === 0 &&
      state.selectedIntakeBlockId !== null
    ) {
      updateState({
        selectedIntakeBlockId: null,
        selectedIntakeLineIndex: null,
      });

      return;
    }

    if (
      blocks.length > 0 &&
      !blocks.some(
        (block) =>
          block.id ===
          state.selectedIntakeBlockId,
      )
    ) {
      updateState({
        selectedIntakeBlockId: blocks[0].id,
        selectedIntakeLineIndex: null,
      });
    }
  }, [
    blocks,
    state.mode,
    state.selectedIntakeBlockId,
    updateState,
  ]);

  const renderIntakeStatus = (
    status: keyof typeof intakeStatusConfig,
  ) => {
    const config =
      intakeStatusConfig[status];

    const Icon = config.icon;

    return (
      <Icon
        className={cn(
          'h-3 w-3 flex-shrink-0',
          config.className,
        )}
        aria-label={config.label}
      />
    );
  };

  return (
    <>
      <div className="flex h-10 items-center justify-between border-b border-border px-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Blocks
        </span>

        <div className="flex items-center gap-2 text-xs font-semibold">
          {intakeIssueCount > 0 && (
            <span
              className={cn(
                'whitespace-nowrap rounded-full px-1.5 py-0.5 text-[10px]',
                invalidBlockCount > 0
                  ? 'bg-destructive/10 text-destructive'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
              )}
            >
              {invalidBlockCount} invalid ·{' '}
              {intakeIssueCount} issue
              {intakeIssueCount === 1 ? '' : 's'}
            </span>
          )}

          <span className="text-foreground">
            {blocks.length}
          </span>
        </div>
      </div>

      {blocks.length === 0 ? (
        <div className="p-3">
          <EmptyState message="Paste AI response to begin" />
        </div>
      ) : (
        <ul className="m-0 flex min-h-0 flex-1 list-none flex-col overflow-y-auto p-0">
          {blocks.map((block) => {
            const issueCount = new Set([
              ...block.errors,
              ...block.warnings,
            ]).size;

            return (
              <li key={block.id}>
                <button
                  type="button"
                  onClick={() =>
                    updateState({
                      selectedIntakeBlockId:
                        block.id,
                      selectedIntakeLineIndex:
                        null,
                      rightPanelOwner:
                        'inspector',
                    })
                  }
                  className={cn(
                    'w-full border-b border-border px-3 py-2 text-left transition',
                    block.status === 'error' &&
                      'border-l-2 border-l-destructive',
                    block.status ===
                      'incomplete' &&
                      'border-l-2 border-l-amber-500',
                    block.id ===
                      state.selectedIntakeBlockId
                      ? 'bg-primary/10'
                      : 'hover:bg-secondary/70',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {block.mode && (
                          <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-medium lowercase text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                            {block.mode}
                          </span>
                        )}
                      </div>

                      <span
                        className="mt-1 block truncate text-xs font-medium text-foreground"
                        title={block.label}
                      >
                        {block.label}
                      </span>

                      {block.mode ===
                        'replace_node' &&
                        block.selectorText && (
                          <div
                            className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground"
                            title={
                              block.selectorText
                            }
                          >
                            {
                              block.selectorText
                            }
                          </div>
                        )}
                    </div>

                    <div className="flex flex-shrink-0 items-center gap-1.5">
                      {issueCount > 0 && (
                        <span
                          className={cn(
                            'rounded-full px-1.5 py-0.5 text-[9px] font-semibold',
                            block.status ===
                              'error'
                              ? 'bg-destructive/10 text-destructive'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
                          )}
                        >
                          {issueCount}
                        </span>
                      )}

                      {renderIntakeStatus(
                        block.status,
                      )}
                    </div>
                  </div>

                  <p className="mt-1 text-xs text-muted-foreground">
                    Lines{' '}
                    {block.startLine + 1}–
                    {block.endLine + 1}
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}