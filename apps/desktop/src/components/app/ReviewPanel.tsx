import React, { useEffect, useMemo, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { Decoration, EditorView, WidgetType, keymap } from '@codemirror/view';
import { indentWithTab } from '@codemirror/commands';
import { indentUnit } from '@codemirror/language';
import { EditorState, type Range, StateField } from '@codemirror/state';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { php } from '@codemirror/lang-php';
import { python } from '@codemirror/lang-python';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { xml } from '@codemirror/lang-xml';
import { yaml } from '@codemirror/lang-yaml';
import { oneDark } from '@codemirror/theme-one-dark';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useAppStateContext, useReviewActions } from '@/hooks';
import { buildResultReviewModel, buildUnifiedDiffModel } from '@/utils/reviewComparison';
import { buildReviewItemPreflightFingerprint, getCurrentReviewPreflight } from '@/utils';
import { cn } from '@/lib/utils';
import type { Operation } from '@inscribe/shared';
import type { ReviewItem, V1ReviewItem, ReviewPreflightResult, ReviewView, ReviewComparison } from '@/types';

class DeletedRegionWidget extends WidgetType {
  constructor(
    private readonly regionId: string,
    private readonly summary: string,
  ) {
    super();
  }

  toDOM() {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'cm-review-deleted-widget';
    button.dataset.reviewRegionId = this.regionId;
    button.textContent = this.summary;
    return button;
  }
}

const reviewViewOptions: Array<{ id: ReviewView; label: string }> = [
  { id: 'result', label: 'result' },
  { id: 'unified', label: 'diff' },
  { id: 'edit', label: 'edit' },
];

function isV1ReviewItem(item: ReviewItem): item is V1ReviewItem {
  return item.engineVersion !== 'v2';
}

const buildOperationFromReviewItem = (item: V1ReviewItem): Operation => {
  return {
    type: item.mode,
    file: item.file,
    content: item.editedContent,
    directives: item.directives,
    blockIndex: item.blockIndex,
  };
};

export function ReviewPanel() {
  const { state, updateState } = useAppStateContext();
  const reviewActions = useReviewActions();
  const { selectedItem, editorValue } = reviewActions;
  const [previewEditorView, setPreviewEditorView] = useState<EditorView | null>(null);
  const selectedIsApplied = selectedItem?.status === 'applied';
  const canEditSelection = Boolean(selectedItem) && !selectedIsApplied && selectedItem?.engineVersion !== 'v2';
  const activeReviewView = canEditSelection ? state.reviewView : state.reviewView === 'edit' ? 'unified' : state.reviewView;
  const isEditing = activeReviewView === 'edit';
  const selectedItemId = selectedItem?.id ?? null;
  const selectedFingerprint = selectedItem ? buildReviewItemPreflightFingerprint(selectedItem) : null;
  const selectedComparisonSnapshot = selectedItemId ? state.reviewComparisonByItem[selectedItemId] : null;
  const comparisonData =
    selectedComparisonSnapshot && selectedComparisonSnapshot.fingerprint === selectedFingerprint
      ? selectedComparisonSnapshot.comparison
      : null;
  const collapsedHunkIds = selectedItemId ? state.collapsedHunkIdsByItem[selectedItemId] ?? [] : [];
  const collapsedDiffGroupIds = selectedItemId ? state.collapsedDiffGroupIdsByItem[selectedItemId] ?? [] : [];

  const setItemPreflightResult = (
    item: ReviewItem,
    result: ReviewPreflightResult,
  ) => {
    updateState((prev) => {
      const currentItem = prev.reviewItems.find((candidate) => candidate.id === item.id);
      if (!currentItem || buildReviewItemPreflightFingerprint(currentItem) !== result.fingerprint) {
        return {};
      }
      const previousResult = prev.reviewPreflightByItem[item.id];
      const selectedComparisonError =
        result.status === 'failed' ? result.error ?? 'Review comparison/preflight failed.' : null;
      const isSameResult =
        previousResult?.status === result.status &&
        previousResult?.fingerprint === result.fingerprint &&
        previousResult?.error === result.error;

      if (isSameResult) {
        return prev.selectedItemId === item.id && prev.reviewComparisonError !== selectedComparisonError
          ? { reviewComparisonError: selectedComparisonError }
          : {};
      }

      return {
        reviewPreflightByItem: {
          ...prev.reviewPreflightByItem,
          [item.id]: result,
        },
        ...(prev.selectedItemId === item.id
          ? { reviewComparisonError: selectedComparisonError }
          : {}),
      };
    });
  };

  const setItemComparisonSnapshot = (
    item: ReviewItem,
    comparison: ReviewComparison,
  ) => {
    const fingerprint = buildReviewItemPreflightFingerprint(item);
    updateState((prev) => {
      const currentItem = prev.reviewItems.find((candidate) => candidate.id === item.id);
      if (!currentItem || buildReviewItemPreflightFingerprint(currentItem) !== fingerprint) {
        return {};
      }

      return {
        reviewComparisonByItem: {
          ...prev.reviewComparisonByItem,
          [item.id]: { fingerprint, comparison },
        },
      };
    });
  };

  useEffect(() => {
    if (state.mode !== 'review' || !state.repoRoot) {
      return;
    }

    const repoRoot = state.repoRoot;
    const reviewItemsById = new Map(state.reviewItems.map((item) => [item.id, item]));
    const pendingItemsNeedingPreflight = state.reviewItems.filter(isV1ReviewItem).filter(
      (item) => item.status === 'pending' && !getCurrentReviewPreflight(item, state.reviewPreflightByItem),
    );
    const stalePreflightIds = Object.keys(state.reviewPreflightByItem).filter((itemId) => {
      const item = reviewItemsById.get(itemId);
      return !item || (item.engineVersion !== 'v2' && (item.status !== 'pending' || !getCurrentReviewPreflight(item, state.reviewPreflightByItem)));
    });

    if (pendingItemsNeedingPreflight.length === 0 && stalePreflightIds.length === 0) {
      return;
    }

    updateState((prev) => {
      const nextPreflightByItem = { ...prev.reviewPreflightByItem };
      stalePreflightIds.forEach((itemId) => {
        delete nextPreflightByItem[itemId];
      });
      pendingItemsNeedingPreflight.forEach((item) => {
        nextPreflightByItem[item.id] = {
          status: 'checking',
          fingerprint: buildReviewItemPreflightFingerprint(item),
        };
      });
      return { reviewPreflightByItem: nextPreflightByItem };
    });

    pendingItemsNeedingPreflight.forEach((item) => {
      const fingerprint = buildReviewItemPreflightFingerprint(item);
      window.inscribeAPI.compareOperation(buildOperationFromReviewItem(item), repoRoot)
        .then((result) => {
          if (!('error' in result)) {
            setItemComparisonSnapshot(item, result);
          }
          setItemPreflightResult(
            item,
            'error' in result
              ? { status: 'failed', fingerprint, error: result.error }
              : { status: 'passed', fingerprint },
          );
        })
        .catch((error) => {
          setItemPreflightResult(item, {
            status: 'failed',
            fingerprint,
            error: error instanceof Error ? error.message : 'Failed to run review comparison/preflight.',
          });
        });
    });
  }, [state.mode, state.repoRoot, state.reviewItems, state.reviewPreflightByItem, updateState]);

  const languageExtension = useMemo(() => {
    const fileName = selectedItem?.file;
    if (!fileName) return null;
    const extension = fileName.split('.').pop()?.toLowerCase() ?? 'txt';
    const shouldPreferPhp = editorValue.includes('<?php');
    switch (extension) {
      case 'ts':
      case 'tsx':
        return javascript({ typescript: true, jsx: extension === 'tsx' });
      case 'js':
      case 'jsx':
        return javascript({ jsx: extension === 'jsx' });
      case 'json':
        return json();
      case 'md':
      case 'markdown':
        return markdown();
      case 'py':
        return python();
      case 'html':
      case 'htm':
        return html();
      case 'css':
      case 'scss':
      case 'sass':
        return css();
      case 'xml':
      case 'svg':
        return xml();
      case 'yml':
      case 'yaml':
        return yaml();
      case 'php':
      case 'phtml':
        return php();
      case 'txt':
      default:
        return shouldPreferPhp ? php() : javascript();
    }
  }, [editorValue, selectedItem?.file]);

  const editorExtensions = useMemo(() => {
    const baseExtensions = [indentUnit.of('\t'), keymap.of([indentWithTab])];
    if (languageExtension) baseExtensions.push(languageExtension);
    return baseExtensions;
  }, [languageExtension]);

  useEffect(() => {
    let cancelled = false;

    const loadComparison = async () => {
      updateState({ selectedHunkId: null });

      if (!state.repoRoot || !selectedItem || isEditing) {
        updateState({ reviewComparisonError: null });
        return;
      }

      if (selectedIsApplied) {
        updateState({
          reviewComparisonError: comparisonData
            ? null
            : 'Applied comparison snapshot is unavailable for this change.',
        });
        return;
      }

      if (selectedItem.engineVersion === 'v2') {
        if (comparisonData) {
          updateState({ reviewComparisonError: null });
        } else {
          updateState({ reviewComparisonError: 'Canonical V2 comparison snapshot is missing.' });
        }
        return;
      }

      const preflight = getCurrentReviewPreflight(selectedItem, state.reviewPreflightByItem);
      if (preflight?.status === 'failed') {
        updateState({ reviewComparisonError: preflight.error ?? 'Review comparison/preflight failed.' });
        return;
      }

      if (comparisonData) {
        updateState({ reviewComparisonError: null });
        return;
      }

      const fingerprint = buildReviewItemPreflightFingerprint(selectedItem);
      const operation = buildOperationFromReviewItem(selectedItem);

      try {
        const result = await window.inscribeAPI.compareOperation(operation, state.repoRoot);
        if (cancelled) return;
        if ('error' in result) {
          setItemPreflightResult(selectedItem, { status: 'failed', fingerprint, error: result.error });
          updateState({ reviewComparisonError: result.error });
          return;
        }
        setItemComparisonSnapshot(selectedItem, result);
        setItemPreflightResult(selectedItem, { status: 'passed', fingerprint });
        updateState({ reviewComparisonError: null });
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : 'Failed to load comparison';
        setItemPreflightResult(selectedItem, { status: 'failed', fingerprint, error: message });
        updateState({ reviewComparisonError: message });
      }
    };

    void loadComparison();

    return () => {
      cancelled = true;
    };
  }, [comparisonData, editorValue, isEditing, selectedIsApplied, selectedItem, state.repoRoot, state.reviewPreflightByItem, updateState]);

  useEffect(() => {
    if (selectedItem?.engineVersion === 'v2' && state.reviewView === 'edit') {
      updateState({ reviewView: 'result', isEditing: false });
    }
  }, [selectedItem, state.reviewView, updateState]);

  const resultModel = useMemo(
    () => (comparisonData ? buildResultReviewModel(comparisonData) : null),
    [comparisonData],
  );

  const unifiedModel = useMemo(
    () => (comparisonData ? buildUnifiedDiffModel(comparisonData) : null),
    [comparisonData],
  );
  const selectedDisplayHunkId = useMemo(
    () => unifiedModel?.hunks.find((hunk) => (
      state.selectedHunkId ? hunk.sourceHunkIds.includes(state.selectedHunkId) : false
    ))?.id ?? null,
    [state.selectedHunkId, unifiedModel],
  );

  useEffect(() => {
    if (!state.selectedHunkId && unifiedModel?.hunks.length) {
      updateState({ selectedHunkId: unifiedModel.hunks[0].sourceHunkIds[0] ?? null });
    }
  }, [state.selectedHunkId, unifiedModel, updateState]);

  const comparisonExtensions = useMemo(() => {
    if (!resultModel) return [];

    const regionsById = new Map(resultModel.regions.map((region) => [region.id, region]));
    const findRegionAtPosition = (position: number) =>
      resultModel.regions.find((region) => {
        if (region.highlightEnd > region.highlightStart) {
          return position >= region.highlightStart && position < region.highlightEnd;
        }
        return position === region.anchorOffset;
      }) ?? null;

    const buildDecorations = () => {
      const decorations: Range<Decoration>[] = [];

      resultModel.regions.forEach((region) => {
        const isSelected = region.id === state.selectedHunkId;
        if (region.highlightEnd > region.highlightStart) {
          decorations.push(Decoration.mark({
            attributes: {
              class: isSelected ? 'cm-review-region cm-review-region-selected' : 'cm-review-region',
              'data-review-region-id': region.id,
            },
          }).range(region.highlightStart, region.highlightEnd));
        }

        if (region.kind === 'delete' && region.deletedSummary) {
          decorations.push(Decoration.widget({
            widget: new DeletedRegionWidget(region.id, region.deletedSummary),
            side: region.anchorSide === 'after' ? 1 : -1,
            block: false,
          }).range(region.anchorOffset, region.anchorOffset));
        }
      });

      resultModel.windows.forEach((window) => {
        if (window.end > window.start) {
          decorations.push(Decoration.mark({ attributes: { class: 'cm-review-window' } }).range(window.start, window.end));
        }
      });

      return Decoration.set(decorations, true);
    };

    const comparisonField = StateField.define({
      create: buildDecorations,
      update(decorations, transaction) {
        if (transaction.docChanged) return buildDecorations();
        return decorations;
      },
      provide: (field) => EditorView.decorations.from(field),
    });

    const comparisonTheme = EditorView.theme({
      '.cm-review-region': {
        backgroundColor: 'rgba(59, 130, 246, 0.16)',
        borderRadius: '0.2rem',
        cursor: 'pointer',
      },
      '.cm-review-window': {
        backgroundColor: 'rgba(148, 163, 184, 0.08)',
        outline: '1px dashed rgba(148, 163, 184, 0.20)',
      },
      '.cm-review-region-selected': {
        backgroundColor: 'rgba(96, 165, 250, 0.3)',
        outline: '1px solid rgba(96, 165, 250, 0.45)',
      },
      '.cm-review-deleted-widget': {
        margin: '0 0.4rem',
        padding: '0.125rem 0.5rem',
        borderRadius: '9999px',
        border: '1px dashed rgba(248, 113, 113, 0.55)',
        backgroundColor: 'rgba(127, 29, 29, 0.25)',
        color: 'rgb(254, 202, 202)',
        fontSize: '0.75rem',
        lineHeight: '1.2',
        cursor: 'pointer',
      },
    });

    const interactionExtension = EditorView.domEventHandlers({
      mousedown: (event, view) => {
        const target = event.target as HTMLElement | null;
        const regionElement = target?.closest('[data-review-region-id]') as HTMLElement | null;
        const directRegionId = regionElement?.dataset.reviewRegionId;
        if (directRegionId && regionsById.has(directRegionId)) {
          updateState({ selectedHunkId: directRegionId });
          return true;
        }

        const position = view.posAtCoords({ x: event.clientX, y: event.clientY });
        if (position === null) return false;
        const region = findRegionAtPosition(position);
        if (!region) return false;
        updateState({ selectedHunkId: region.id });
        return true;
      },
    });

    return [comparisonTheme, comparisonField, interactionExtension];
  }, [resultModel, state.selectedHunkId, updateState]);

  useEffect(() => {
    if (!previewEditorView || !resultModel || !state.selectedHunkId || activeReviewView !== 'result') return;
    const active = resultModel.regions.find((region) => region.id === state.selectedHunkId);
    if (!active) return;
    const focusPos = active.highlightStart > 0 ? active.highlightStart : active.anchorOffset;
    previewEditorView.dispatch({ selection: { anchor: focusPos } });
    previewEditorView.dispatch({
      effects: EditorView.scrollIntoView(focusPos, { y: 'center' }),
    });
  }, [activeReviewView, previewEditorView, resultModel, state.selectedHunkId]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!unifiedModel?.hunks.length || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return;
      const key = event.key.toLowerCase();
      if (key !== 'n' && event.key !== 'F7') return;

      const direction = event.shiftKey ? -1 : 1;
      const current = unifiedModel.hunks.findIndex((hunk) => (
        state.selectedHunkId ? hunk.sourceHunkIds.includes(state.selectedHunkId) : false
      ));
      const base = current === -1 ? (direction > 0 ? -1 : 0) : current;
      const next = (base + direction + unifiedModel.hunks.length) % unifiedModel.hunks.length;
      updateState({ selectedHunkId: unifiedModel.hunks[next].sourceHunkIds[0] ?? null });
      event.preventDefault();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.selectedHunkId, unifiedModel, updateState]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' || activeReviewView !== 'unified' || !selectedItemId || !selectedDisplayHunkId) return;
      if (!collapsedHunkIds.includes(selectedDisplayHunkId)) return;
      updateState((prev) => ({
        collapsedHunkIdsByItem: {
          ...prev.collapsedHunkIdsByItem,
          [selectedItemId]: collapsedHunkIds.filter((id) => id !== selectedDisplayHunkId),
        },
      }));
      event.preventDefault();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeReviewView, collapsedHunkIds, selectedDisplayHunkId, selectedItemId, updateState]);

  if (!selectedItem) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center text-sm text-muted-foreground">
        Select a change from the left pane.
      </div>
    );
  }

  const displayContent = comparisonData?.newContent ?? editorValue;

  return (
    <section className="flex h-full min-h-0 flex-col bg-background">
      <div className="h-10 flex items-center justify-between gap-3 border-b border-border bg-card px-3">
        <div className="min-w-0 flex items-center gap-2">
          <span className="inline-code max-w-[60vw] truncate" title={selectedItem.file}>
            {selectedItem.file}
          </span>
        </div>
        <div className="flex items-center rounded-md border border-border bg-secondary/60 p-0.5">
          {reviewViewOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              disabled={option.id === 'edit' && !canEditSelection}
              onClick={() => updateState({ reviewView: option.id, isEditing: option.id === 'edit' })}
              className={cn(
                'h-7 rounded px-2.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                activeReviewView === option.id
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        {activeReviewView === 'unified' && unifiedModel && unifiedModel.hunks.length > 0 && selectedItemId && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="h-7 rounded-md px-2 text-xs font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground"
              onClick={() =>
                updateState((prev) => ({
                  collapsedHunkIdsByItem: {
                    ...prev.collapsedHunkIdsByItem,
                    [selectedItemId]: unifiedModel.hunks.map((hunk) => hunk.id),
                  },
                }))
              }
            >
              Collapse All
            </button>
            <button
              type="button"
              className="h-7 rounded-md px-2 text-xs font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground"
              onClick={() =>
                updateState((prev) => ({
                  collapsedHunkIdsByItem: {
                    ...prev.collapsedHunkIdsByItem,
                    [selectedItemId]: [],
                  },
                }))
              }
            >
              Expand All
            </button>
          </div>
        )}
      </div>

      {selectedItem.engineVersion === 'v2' && selectedItem.targetScope.matchMetadata?.kind === 'fallback' && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2 text-xs text-amber-500 flex items-center justify-between flex-shrink-0">
          <span className="flex items-center gap-1.5">
            <span className="font-semibold">⚠️ Fallback Matching Used:</span>
            <span>Matched with score {Math.round(selectedItem.targetScope.matchMetadata.score! * 100)}% (Exact match failed).</span>
          </span>
          {selectedItem.targetScope.matchMetadata.unmatchedSoftTokens && selectedItem.targetScope.matchMetadata.unmatchedSoftTokens.length > 0 && (
            <span className="text-muted-foreground">
              Unmatched soft tokens: {selectedItem.targetScope.matchMetadata.unmatchedSoftTokens.map(t => `'${t}'`).join(', ')}
            </span>
          )}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-hidden">
        {!isEditing && state.reviewComparisonError && (
          <div className="flex h-full items-center justify-center p-6 text-sm text-destructive">
            <div className="max-w-2xl rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3">
              {state.reviewComparisonError}
            </div>
          </div>
        )}

        {activeReviewView === 'edit' && (
          <CodeMirror
            className="h-full w-full overflow-hidden text-sm font-mono"
            value={editorValue}
            height="100%"
            theme={oneDark}
            extensions={editorExtensions}
            onChange={(value: string) => reviewActions.handleEditorChange(value)}
            basicSetup={{ lineNumbers: true, foldGutter: false }}
          />
        )}

        {activeReviewView === 'result' && !state.reviewComparisonError && (
          <div className="review-preview h-full w-full overflow-hidden text-sm font-mono">
            <CodeMirror
              className="h-full w-full overflow-hidden text-sm font-mono"
              value={displayContent}
              height="100%"
              theme={oneDark}
              extensions={[...editorExtensions, ...comparisonExtensions]}
              editable={false}
              readOnly
              basicSetup={{ lineNumbers: true, foldGutter: false }}
              onCreateEditor={(view) => setPreviewEditorView(view)}
            />
          </div>
        )}

        {activeReviewView === 'unified' && !state.reviewComparisonError && (
          <UnifiedDiffView
            model={unifiedModel}
            selectedHunkId={state.selectedHunkId}
            collapsedHunkIds={collapsedHunkIds}
            collapsedDiffGroupIds={collapsedDiffGroupIds}
            onSelectHunk={(hunkId) => updateState({ selectedHunkId: hunkId })}
            onToggleHunk={(hunkId) => {
              if (!selectedItemId) return;
              updateState((prev) => {
                const current = prev.collapsedHunkIdsByItem[selectedItemId] ?? [];
                const next = current.includes(hunkId)
                  ? current.filter((id) => id !== hunkId)
                  : [...current, hunkId];
                return {
                  collapsedHunkIdsByItem: {
                    ...prev.collapsedHunkIdsByItem,
                    [selectedItemId]: next,
                  },
                };
              });
            }}
            onToggleGroup={(groupId) => {
              if (!selectedItemId) return;
              updateState((prev) => {
                const current = prev.collapsedDiffGroupIdsByItem[selectedItemId] ?? [];
                const next = current.includes(groupId)
                  ? current.filter((id) => id !== groupId)
                  : [...current, groupId];
                return {
                  collapsedDiffGroupIdsByItem: {
                    ...prev.collapsedDiffGroupIdsByItem,
                    [selectedItemId]: next,
                  },
                };
              });
            }}
          />
        )}
      </div>
    </section>
  );
}

function UnifiedDiffView({
  model,
  selectedHunkId,
  collapsedHunkIds,
  collapsedDiffGroupIds,
  onSelectHunk,
  onToggleHunk,
  onToggleGroup,
}: {
  model: ReturnType<typeof buildUnifiedDiffModel> | null;
  selectedHunkId: string | null;
  collapsedHunkIds: string[];
  collapsedDiffGroupIds: string[];
  onSelectHunk: (hunkId: string) => void;
  onToggleHunk: (hunkId: string) => void;
  onToggleGroup: (groupId: string) => void;
}) {
  if (!model) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Loading comparison...
      </div>
    );
  }

  if (model.hunks.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No diff hunks for this change.
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto bg-[#111827] font-mono text-xs text-slate-200">
      <div className="min-w-max py-2">
        {model.hunks.map((hunk) => {
          const isCollapsed = collapsedHunkIds.includes(hunk.id);
          const isSelected = selectedHunkId ? hunk.sourceHunkIds.includes(selectedHunkId) : false;
          return (
            <div key={hunk.id}>
              <button
                type="button"
                onClick={() => {
                  const firstSourceHunkId = hunk.sourceHunkIds[0];
                  if (firstSourceHunkId) {
                    onSelectHunk(firstSourceHunkId);
                  }
                  onToggleHunk(hunk.id);
                }}
                className={cn(
                  'grid w-full grid-cols-[2rem_4rem_4rem_minmax(12rem,1fr)_10rem] items-center bg-slate-800/90 text-left leading-7 text-sky-200 hover:bg-slate-700/90',
                  isSelected && 'outline outline-1 outline-inset outline-sky-500/70',
                )}
              >
                <span className="flex items-center justify-center text-slate-400">
                  {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </span>
                <span className="px-2 text-right text-slate-500">{hunk.oldStartLine}</span>
                <span className="px-2 text-right text-slate-500">{hunk.newStartLine}</span>
                <span className="truncate px-2">{hunk.header}</span>
                <span className="px-2 text-right text-[11px] text-slate-400">
                  {hunk.removedCount} removed, {hunk.addedCount} added
                </span>
              </button>
              {!isCollapsed && (
                <>
                  {hunk.segments.map((segment) => {
                    const isSegmentCollapsed = collapsedDiffGroupIds.includes(segment.id);
                    if (segment.kind === 'context') {
                      return (
                        <ContextLineGroup
                          key={segment.id}
                          groupId={segment.id}
                          label={segment.label}
                          rows={segment.rows}
                          isCollapsed={isSegmentCollapsed}
                          selectedHunkId={selectedHunkId}
                          onSelectHunk={onSelectHunk}
                          onToggleGroup={onToggleGroup}
                        />
                      );
                    }

                    return (
                      <DiffLineGroup
                        key={segment.id}
                        groupId={segment.id}
                        label={segment.kind === 'remove' ? 'removed' : 'added'}
                        count={segment.rows.length}
                        rows={segment.rows}
                        isCollapsed={isSegmentCollapsed}
                        selectedHunkId={selectedHunkId}
                        onSelectHunk={onSelectHunk}
                        onToggleGroup={onToggleGroup}
                      />
                    );
                  })}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ContextLineGroup({
  groupId,
  label,
  rows,
  isCollapsed,
  selectedHunkId,
  onSelectHunk,
  onToggleGroup,
}: {
  groupId: string;
  label: string;
  rows: ReturnType<typeof buildUnifiedDiffModel>['hunks'][number]['rows'];
  isCollapsed: boolean;
  selectedHunkId: string | null;
  onSelectHunk: (hunkId: string) => void;
  onToggleGroup: (groupId: string) => void;
}) {
  if (rows.length === 0) {
    return null;
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => onToggleGroup(groupId)}
        className="grid w-full grid-cols-[2rem_4rem_4rem_2rem_minmax(0,1fr)] items-center bg-slate-900/80 text-left leading-6 text-slate-300"
      >
        <span className="flex items-center justify-center text-slate-500">
          {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </span>
        <span />
        <span />
        <span className="text-slate-500"> </span>
        <span className="px-2 text-[11px] text-slate-400">
          {rows.length} {label}
        </span>
      </button>
      {!isCollapsed && (
        <DiffRows
          rows={rows}
          selectedHunkId={selectedHunkId}
          onSelectHunk={onSelectHunk}
        />
      )}
    </div>
  );
}

function DiffLineGroup({
  groupId,
  label,
  count,
  rows,
  isCollapsed,
  selectedHunkId,
  onSelectHunk,
  onToggleGroup,
}: {
  groupId: string;
  label: 'removed' | 'added';
  count: number;
  rows: ReturnType<typeof buildUnifiedDiffModel>['hunks'][number]['rows'];
  isCollapsed: boolean;
  selectedHunkId: string | null;
  onSelectHunk: (hunkId: string) => void;
  onToggleGroup: (groupId: string) => void;
}) {
  if (count === 0) {
    return null;
  }

  const canFold = count > 1;

  return (
    <div>
      {canFold && (
        <button
          type="button"
          onClick={() => onToggleGroup(groupId)}
          className={cn(
            'grid w-full grid-cols-[2rem_4rem_4rem_2rem_minmax(0,1fr)] items-center text-left leading-6',
            label === 'removed' ? 'bg-red-950/45 text-red-100' : 'bg-emerald-950/45 text-emerald-100',
          )}
        >
          <span className="flex items-center justify-center text-slate-400">
            {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </span>
          <span />
          <span />
          <span className="text-slate-400">{label === 'removed' ? '-' : '+'}</span>
          <span className="px-2 text-[11px] text-slate-300">
            {count} {label}
          </span>
        </button>
      )}
      {(!canFold || !isCollapsed) && (
        <DiffRows
          rows={rows}
          selectedHunkId={selectedHunkId}
          onSelectHunk={onSelectHunk}
        />
      )}
    </div>
  );
}

function DiffRows({
  rows,
  selectedHunkId,
  onSelectHunk,
}: {
  rows: ReturnType<typeof buildUnifiedDiffModel>['hunks'][number]['rows'];
  selectedHunkId: string | null;
  onSelectHunk: (hunkId: string) => void;
}) {
  return (
    <>
      {rows.map((row) => (
        <button
          type="button"
          key={row.id}
          onClick={() => onSelectHunk(row.hunkId)}
          className={cn(
            'grid w-full grid-cols-[4rem_4rem_2rem_minmax(0,1fr)] items-start text-left leading-5',
            row.kind === 'context' && 'bg-slate-950/55 text-slate-300',
            row.kind === 'remove' && 'bg-red-950/35 text-red-100',
            row.kind === 'add' && 'bg-emerald-950/35 text-emerald-100',
            selectedHunkId === row.hunkId && 'outline outline-1 outline-inset outline-sky-500/50',
          )}
        >
          <span className="px-2 text-right text-slate-500">{row.oldLine ?? ''}</span>
          <span className="px-2 text-right text-slate-500">{row.newLine ?? ''}</span>
          <span className="px-2 text-slate-400">{row.marker}</span>
          <span className="whitespace-pre px-2">{row.text || ' '}</span>
        </button>
      ))}
    </>
  );
}
