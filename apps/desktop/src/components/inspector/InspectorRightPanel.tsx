import { useState } from 'react';
import {
  FileCode2,
  Trash2,
} from 'lucide-react';
import type { ReviewItem } from '@/types';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui';
import {
  useAppStateContext,
  useIntakeBlocks,
} from '@/hooks';
import {
  parseLiveIntakeStructure,
  removeIntakeBlockFromText,
  toSentenceCase,
} from '@/utils';
import { buildDiagnosticGroups } from '@/utils/diagnostics';
import { PanelTabs } from '@/components/ui/panel-tabs';
import { cn } from '@/lib/utils';
import {
  buildIntakeChangeInvalidation,
  buildReviewExitUpdate,
} from '@/state/workflowTransitions';
import { DiagnosticsSection } from './DiagnosticsSection';
import { IntakeDirectiveSection } from './IntakeInspector';
import {
  InspectorEmptyState,
} from './InspectorPrimitives';
import { ReviewFileProperties } from './ReviewFileProperties';

export function InspectorRightPanel() {
  const { state, updateState } = useAppStateContext();
  const { blocks, warnings: globalWarnings } = useIntakeBlocks();

  const selectedBlock =
    blocks.find((block) => block.id === state.selectedIntakeBlockId) ?? null;

  const selectedReviewFile =
    state.reviewFiles.find((file) => file.id === state.selectedReviewFileId) ??
    null;

  const selectedReviewOperations: ReviewItem[] = selectedReviewFile
    ? state.reviewItems.filter((item) =>
        selectedReviewFile.operationIds.includes(item.id),
      )
    : [];

  const [blockPendingRemoval, setBlockPendingRemoval] =
    useState<typeof selectedBlock>(null);

  const diagnostics = buildDiagnosticGroups(state, blocks, {
    mode: state.mode,
    globalWarnings,
  });

  const diagnosticCount = diagnostics.reduce(
    (sum, group) => sum + group.messages.length,
    0,
  );

  const selectionLabel =
    state.mode === 'intake'
      ? selectedBlock?.label ?? 'No block selected'
      : selectedReviewFile?.filePath ?? 'No change selected';

  const selectionStatus =
    state.mode === 'intake'
      ? selectedBlock?.status
      : selectedReviewFile
        ? selectedReviewOperations.every((item) => item.status === 'applied')
          ? 'applied'
          : 'pending'
        : undefined;

  const selectionMeta =
    state.mode === 'intake'
      ? selectedBlock
        ? `${toSentenceCase(selectedBlock.status)} · Block ${selectedBlock.index + 1}`
        : 'Select a block from the sidebar'
      : selectedReviewFile
        ? `${toSentenceCase(
            selectedReviewOperations.every((item) => item.status === 'applied')
              ? 'applied'
              : 'pending',
          )} · ${selectedReviewOperations.length} operation${selectedReviewOperations.length === 1 ? '' : 's'}`
        : 'Select a change from the sidebar';

  const tabs = [
    {
      id: 'properties' as const,
      label: 'Properties',
    },
    {
      id: 'diagnostics' as const,
      label: 'Diagnostics',
      count: diagnosticCount,
    },
  ];

  const handleNavigateDiagnostic = (target: {
    blockId: string;
    line?: number;
  }) => {
    updateState({
      ...buildReviewExitUpdate(),
      selectedIntakeBlockId: target.blockId,
      selectedIntakeLineIndex:
        typeof target.line === 'number'
          ? Math.max(0, target.line - 1)
          : null,
      statusMessage: target.line
        ? `Selected diagnostic at line ${target.line}.`
        : 'Selected block diagnostic.',
    });
  };

  const handleConfirmRemoveBlock = () => {
    if (!blockPendingRemoval) {
      return;
    }

    const removedIndex = blocks.findIndex(
      (block) => block.id === blockPendingRemoval.id,
    );

    const nextInput = removeIntakeBlockFromText(
      state.aiInput,
      blockPendingRemoval,
    );

    const nextStructure = parseLiveIntakeStructure(nextInput, {
      indexedFileSet: state.indexedFileSet,
    });

    const nextSelection =
      nextStructure.blocks.length > 0
        ? nextStructure.blocks[
            Math.min(
              Math.max(removedIndex, 0),
              nextStructure.blocks.length - 1,
            )
          ].id
        : null;

    updateState((prev) => ({
      ...buildIntakeChangeInvalidation(prev),
      aiInput: nextInput,
      mode: 'intake',
      parseErrors: [],
      previewDiagnostics: [],
      reviewItems: [],
      reviewFiles: [],
      selectedReviewFileId: null,
      selectedIntakeBlockId: nextSelection,
      selectedIntakeLineIndex: null,
      rightPanelOwner: 'inspector',
      rightPanelView: 'properties',
      selectedHunkId: null,
      reviewView: 'unified',
      collapsedHunkIdsByFile: {},
      collapsedDiffGroupIdsByFile: {},
      previewSession: null,
      pipelineStatus: 'idle',
      statusMessage: `Removed ${blockPendingRemoval.label}. Preview the remaining blocks again.`,
    }));

    setBlockPendingRemoval(null);
  };

  const removalIssueCount = blockPendingRemoval
    ? new Set([
        ...blockPendingRemoval.errors,
        ...blockPendingRemoval.warnings,
      ]).size
    : 0;

  return (
    <>
      <aside className="flex min-h-0 flex-col border-l border-border bg-card">
        <div className="flex h-10 flex-shrink-0 items-center justify-between border-b border-border px-3">
          <p className="text-xs font-semibold text-foreground">Inspector</p>
          <span className="text-[10px] capitalize text-muted-foreground">
            {state.mode}
          </span>
        </div>

        <div className="flex-shrink-0 border-b border-border px-3 py-2.5">
          <div className="flex items-center gap-2">
            <FileCode2 className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />

            <p
              className="min-w-0 flex-1 truncate text-xs font-medium text-foreground"
              title={selectionLabel}
            >
              {selectionLabel}
            </p>

            {state.mode === 'intake' && selectedBlock && (
              <button
                type="button"
                className="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setBlockPendingRemoval(selectedBlock)}
                aria-label={`Remove ${selectedBlock.label}`}
                title="Remove block"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="mt-1 flex items-center gap-1.5 pl-5 text-[10px] text-muted-foreground">
            {selectionStatus && (
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  selectionStatus === 'error'
                    ? 'bg-destructive'
                    : selectionStatus === 'warning' ||
                        selectionStatus === 'incomplete'
                      ? 'bg-amber-500'
                      : selectionStatus === 'applied'
                        ? 'bg-primary'
                        : 'bg-emerald-500',
                )}
              />
            )}

            <span className="truncate" title={selectionMeta}>
              {selectionMeta}
            </span>
          </div>
        </div>

        <PanelTabs
          options={tabs}
          value={state.rightPanelView}
          onChange={(value) => updateState({ rightPanelView: value })}
        />

        <div className="min-h-0 flex-1 overflow-y-auto">
          {state.rightPanelView === 'properties' && (
            <div className="px-3 py-3">
              {state.mode === 'intake' ? (
                selectedBlock ? (
                  <IntakeDirectiveSection selectedBlock={selectedBlock} />
                ) : (
                  <InspectorEmptyState message="Select a block to inspect its properties." />
                )
              ) : selectedReviewFile ? (
                <ReviewFileProperties
                  file={selectedReviewFile}
                  operations={selectedReviewOperations}
                />
              ) : (
                <InspectorEmptyState message="Select a change to inspect its properties." />
              )}
            </div>
          )}

          {state.rightPanelView === 'diagnostics' && (
            <div className="px-3 py-3">
              <DiagnosticsSection
                groups={diagnostics}
                onNavigate={handleNavigateDiagnostic}
              />
            </div>
          )}
        </div>
      </aside>

      <Modal
        isOpen={Boolean(blockPendingRemoval)}
        onClose={() => setBlockPendingRemoval(null)}
        title="Remove block?"
        footer={
          <>
            <Button
              variant="outline"
              type="button"
              onClick={() => setBlockPendingRemoval(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              type="button"
              onClick={handleConfirmRemoveBlock}
            >
              <Trash2 className="h-4 w-4" />
              Remove block
            </Button>
          </>
        }
      >
        {blockPendingRemoval && (
          <div className="space-y-3 text-sm">
            <p className="text-foreground">
              This removes the complete block from the intake text. The
              remaining blocks will need to be previewed again.
            </p>

            <div className="rounded-md border border-border bg-secondary/50 p-3">
              <p className="break-all text-xs font-medium text-foreground">
                {blockPendingRemoval.label}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {blockPendingRemoval.mode || 'Unknown mode'} · Lines{' '}
                {blockPendingRemoval.startLine + 1}–
                {blockPendingRemoval.endLine + 1}
                {removalIssueCount > 0
                  ? ` · ${removalIssueCount} issue${removalIssueCount === 1 ? '' : 's'}`
                  : ''}
              </p>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}