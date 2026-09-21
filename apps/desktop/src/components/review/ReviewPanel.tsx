import { useEffect, useMemo } from 'react';
import { useAppStateContext } from '@/hooks';
import { buildUnifiedDiffModel } from '@/utils/reviewComparison';
import { SegmentedControl } from '@/components/ui/segmented-control';
import type { ReviewView } from '@/types';
import { ResultReviewView } from './ResultReviewView';
import { UnifiedDiffView } from './UnifiedDiffView';

const reviewViewOptions: Array<{
  id: ReviewView;
  label: string;
}> = [
  { id: 'result', label: 'result' },
  { id: 'unified', label: 'diff' },
];

export function ReviewPanel() {
  const { state, updateState } = useAppStateContext();

  const selectedFile =
    state.reviewFiles.find(
      (file) => file.id === state.selectedReviewFileId,
    ) ?? null;

  const comparisonData = selectedFile?.comparison ?? null;

  const collapsedHunkIds = selectedFile
    ? state.collapsedHunkIdsByFile[selectedFile.id] ?? []
    : [];

  const collapsedDiffGroupIds = selectedFile
    ? state.collapsedDiffGroupIdsByFile[selectedFile.id] ?? []
    : [];

  const unifiedModel = useMemo(
    () =>
      comparisonData
        ? buildUnifiedDiffModel(comparisonData)
        : null,
    [comparisonData],
  );

  useEffect(() => {
    updateState({
      selectedHunkId: null,
    });
  }, [selectedFile?.id, updateState]);

  useEffect(() => {
    if (
      !state.selectedHunkId &&
      unifiedModel?.hunks.length
    ) {
      updateState({
        selectedHunkId:
          unifiedModel.hunks[0].sourceHunkIds[0] ?? null,
      });
    }
  }, [
    state.selectedHunkId,
    unifiedModel,
    updateState,
  ]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        !unifiedModel?.hunks.length ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target as HTMLElement | null;

      if (
        target &&
        (
          target.isContentEditable ||
          ['INPUT', 'TEXTAREA', 'SELECT'].includes(
            target.tagName,
          )
        )
      ) {
        return;
      }

      if (
        event.key.toLowerCase() !== 'n' &&
        event.key !== 'F7'
      ) {
        return;
      }

      const direction = event.shiftKey ? -1 : 1;

      const current = unifiedModel.hunks.findIndex(
        (hunk) =>
          state.selectedHunkId &&
          hunk.sourceHunkIds.includes(
            state.selectedHunkId,
          ),
      );

      const base =
        current === -1
          ? direction > 0
            ? -1
            : 0
          : current;

      const next =
        (
          base +
          direction +
          unifiedModel.hunks.length
        ) % unifiedModel.hunks.length;

      updateState({
        selectedHunkId:
          unifiedModel.hunks[next].sourceHunkIds[0] ??
          null,
      });

      event.preventDefault();
    };

    window.addEventListener(
      'keydown',
      handleKeyDown,
    );

    return () =>
      window.removeEventListener(
        'keydown',
        handleKeyDown,
      );
  }, [
    state.selectedHunkId,
    unifiedModel,
    updateState,
  ]);

  if (!selectedFile || !comparisonData) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center text-sm text-muted-foreground">
        Select a change from the left pane.
      </div>
    );
  }

  const setCollapsedHunks = (ids: string[]) =>
    updateState((prev) => ({
      collapsedHunkIdsByFile: {
        ...prev.collapsedHunkIdsByFile,
        [selectedFile.id]: ids,
      },
    }));

  const setCollapsedGroups = (ids: string[]) =>
    updateState((prev) => ({
      collapsedDiffGroupIdsByFile: {
        ...prev.collapsedDiffGroupIdsByFile,
        [selectedFile.id]: ids,
      },
    }));

  const selectHunk = (hunkId: string) =>
    updateState({
      selectedHunkId: hunkId,
    });

  return (
    <section className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex h-10 items-center justify-between gap-3 border-b border-border bg-card px-3">
        <span
          className="inline-code max-w-[60vw] truncate"
          title={selectedFile.filePath}
        >
          {selectedFile.filePath}
        </span>

        <SegmentedControl
          options={reviewViewOptions}
          value={state.reviewView}
          onChange={(value) =>
            updateState({ reviewView: value })
          }
        />

        {state.reviewView === 'unified' &&
          unifiedModel &&
          unifiedModel.hunks.length > 0 && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="h-7 rounded-md px-2 text-xs font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground"
                onClick={() =>
                  setCollapsedHunks(
                    unifiedModel.hunks.map(
                      (hunk) => hunk.id,
                    ),
                  )
                }
              >
                Collapse All
              </button>

              <button
                type="button"
                className="h-7 rounded-md px-2 text-xs font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground"
                onClick={() =>
                  setCollapsedHunks([])
                }
              >
                Expand All
              </button>
            </div>
          )}
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {state.reviewView === 'result' && (
          <ResultReviewView
            filePath={selectedFile.filePath}
            comparisonData={comparisonData}
            selectedHunkId={state.selectedHunkId}
            onSelectHunk={selectHunk}
          />
        )}

        {state.reviewView === 'unified' && (
          <UnifiedDiffView
            model={unifiedModel}
            selectedHunkId={state.selectedHunkId}
            collapsedHunkIds={collapsedHunkIds}
            collapsedDiffGroupIds={
              collapsedDiffGroupIds
            }
            onSelectHunk={selectHunk}
            onToggleHunk={(hunkId) =>
              setCollapsedHunks(
                collapsedHunkIds.includes(hunkId)
                  ? collapsedHunkIds.filter(
                      (id) => id !== hunkId,
                    )
                  : [
                      ...collapsedHunkIds,
                      hunkId,
                    ],
              )
            }
            onToggleGroup={(groupId) =>
              setCollapsedGroups(
                collapsedDiffGroupIds.includes(groupId)
                  ? collapsedDiffGroupIds.filter(
                      (id) => id !== groupId,
                    )
                  : [
                      ...collapsedDiffGroupIds,
                      groupId,
                    ],
              )
            }
          />
        )}
      </div>
    </section>
  );
}

export { UnifiedDiffView };