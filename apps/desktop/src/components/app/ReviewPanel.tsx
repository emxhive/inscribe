import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import CodeMirror from '@uiw/react-codemirror';
import { Decoration, EditorView, WidgetType, keymap } from '@codemirror/view';
import { indentWithTab } from '@codemirror/commands';
import { indentUnit } from '@codemirror/language';
import { EditorState, RangeSetBuilder, StateField } from '@codemirror/state';
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
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAppStateContext, useApplyActions, useReviewActions } from '@/hooks';
import { buildReviewRenderModel, buildReviewRegionOverlay, type ReviewRenderableRegion } from '@/utils/reviewComparison';
import { ArrowLeft, Eye, Maximize2, Pencil, X } from 'lucide-react';
import type { OperationComparison, OperationComparisonRegion, Operation } from '@inscribe/shared';

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

export function ReviewPanel() {
  const { state, updateState } = useAppStateContext();
  const reviewActions = useReviewActions();
  const applyActions = useApplyActions();

  const { selectedItem, editorValue } = reviewActions;
  const hasInvalidItems = state.reviewItems.some((item) => item.status === 'invalid');
  const hasAnyApplied = state.reviewItems.some((item) => item.status === 'applied');
  const hasPending = state.reviewItems.some((item) => item.status === 'pending');
  const allApplied =
    state.reviewItems.length > 0 && state.reviewItems.every((item) => item.status === 'applied');
  const selectedIsApplied = selectedItem?.status === 'applied';
  const isApplyingInProgress = state.isApplyingInProgress;
  const canApplySelected =
    Boolean(selectedItem) && selectedItem?.status === 'pending' && !isApplyingInProgress;
  const canEditSelection = Boolean(selectedItem) && !selectedIsApplied;
  const isEditing = state.isEditing && canEditSelection;
  const canUndoSelected =
    Boolean(selectedItem) &&
    selectedIsApplied &&
    state.historyItems.some(
      (item) =>
        item.file === selectedItem?.file &&
        item.blockIndex === selectedItem?.blockIndex &&
        !item.restoredAt
    );
  const [comparisonData, setComparisonData] = useState<OperationComparison | null>(null);
  const [comparisonError, setComparisonError] = useState<string | null>(null);
  const [activeRegionId, setActiveRegionId] = useState<string | null>(null);
  const isOverlayActive = state.overlayEditor === 'review';

  const languageExtension = useMemo(() => {
    const fileName = selectedItem?.file;
    if (!fileName) {
      return null;
    }
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
    if (languageExtension) {
      baseExtensions.push(languageExtension);
    }
    return baseExtensions;
  }, [languageExtension]);

  useEffect(() => {
    let cancelled = false;

    const loadComparison = async () => {
      setActiveRegionId(null);

      if (!state.repoRoot || !selectedItem || isEditing) {
        setComparisonData(null);
        setComparisonError(null);
        return;
      }

      const operation: Operation = {
        type: selectedItem.mode,
        file: selectedItem.file,
        content: editorValue,
        directives: selectedItem.directives,
      };

      try {
        const result = await window.inscribeAPI.compareOperation(operation, state.repoRoot);
        if (cancelled) return;
        if ('error' in result) {
          setComparisonData(null);
          setComparisonError(result.error);
          return;
        }
        setComparisonData(result);
        setComparisonError(null);
      } catch (error) {
        if (cancelled) return;
        setComparisonData(null);
        setComparisonError(error instanceof Error ? error.message : 'Failed to load comparison');
      }
    };

    void loadComparison();

    return () => {
      cancelled = true;
    };
  }, [editorValue, isEditing, selectedItem, state.repoRoot]);

  const renderModel = useMemo(
    () => (comparisonData ? buildReviewRenderModel(comparisonData) : null),
    [comparisonData],
  );

  const selectedRegion = useMemo(() => {
    if (!comparisonData || !activeRegionId) {
      return null;
    }
    return comparisonData.regions.find((region) => region.id === activeRegionId) ?? null;
  }, [activeRegionId, comparisonData]);

  const comparisonExtensions = useMemo(() => {
    if (!renderModel) {
      return [];
    }

    const regionsById = new Map(renderModel.regions.map((region) => [region.id, region]));
    const findRegionAtPosition = (position: number) =>
      renderModel.regions.find((region) => {
        if (region.highlightEnd > region.highlightStart) {
          return position >= region.highlightStart && position < region.highlightEnd;
        }
        return position === region.anchorOffset;
      }) ?? null;

    const buildDecorations = (editorState: EditorState) => {
      const builder = new RangeSetBuilder<Decoration>();

      renderModel.regions.forEach((region) => {
        const isSelected = region.id === activeRegionId;
        if (region.highlightEnd > region.highlightStart) {
          builder.add(
            region.highlightStart,
            region.highlightEnd,
            Decoration.mark({
              attributes: {
                class: isSelected ? 'cm-review-region cm-review-region-selected' : 'cm-review-region',
                'data-review-region-id': region.id,
              },
            }),
          );
        }

        if (region.kind === 'delete' && region.deletedSummary) {
          builder.add(
            region.anchorOffset,
            region.anchorOffset,
            Decoration.widget({
              widget: new DeletedRegionWidget(region.id, region.deletedSummary),
              side: region.anchorSide === 'after' ? 1 : -1,
              block: false,
            }),
          );
        }
      });

      return builder.finish();
    };

    const comparisonField = StateField.define({
      create: buildDecorations,
      update(decorations, transaction) {
        if (transaction.docChanged) {
          return buildDecorations(transaction.state);
        }
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
          setActiveRegionId(directRegionId);
          return true;
        }

        const position = view.posAtCoords({ x: event.clientX, y: event.clientY });
        if (position === null) {
          return false;
        }

        const region = findRegionAtPosition(position);
        if (!region) {
          return false;
        }

        setActiveRegionId(region.id);
        return true;
      },
    });

    return [comparisonTheme, comparisonField, interactionExtension];
  }, [activeRegionId, renderModel]);

  const displayContent = comparisonData?.newContent ?? editorValue;

  const overlayModel = useMemo(
    () => (selectedRegion ? buildReviewRegionOverlay(selectedRegion) : null),
    [selectedRegion],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!selectedItem || event.defaultPrevented) {
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) {
        return;
      }
      const key = event.key.toLowerCase();
      if (key === 'e' && !state.isEditing && !selectedIsApplied) {
        updateState({ isEditing: true });
        event.preventDefault();
      }
      if (key === 'p' && state.isEditing) {
        updateState({ isEditing: false });
        event.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedItem, selectedIsApplied, state.isEditing, updateState]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && activeRegionId) {
        setActiveRegionId(null);
        return;
      }
      if (!isOverlayActive || event.key !== 'Escape') {
        return;
      }
      updateState({ overlayEditor: null });
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeRegionId, isOverlayActive, updateState]);

  useEffect(() => {
    if (!isOverlayActive) {
      return;
    }
    const { style } = document.body;
    const previousOverflow = style.overflow;
    style.overflow = 'hidden';
    return () => {
      style.overflow = previousOverflow;
    };
  }, [isOverlayActive]);

  const editorSurface = (
    <div className="flex-1 w-full h-full border border-border rounded-lg p-3 bg-secondary flex flex-col gap-2">
      {!isEditing && (
        <div className="flex items-center justify-between gap-3 px-1">
          <p className="text-xs text-muted-foreground">
            Result-first review. Click a highlighted region or deletion marker to inspect the local compare.
          </p>
          {comparisonData && (
            <Badge variant="secondary">{comparisonData.regions.length} change region{comparisonData.regions.length === 1 ? '' : 's'}</Badge>
          )}
        </div>
      )}
      {isEditing ? (
        <CodeMirror
          className="flex-1 w-full h-full overflow-hidden rounded-lg text-sm font-mono"
          value={editorValue}
          height="100%"
          theme={oneDark}
          extensions={editorExtensions}
          onChange={(value: string) => reviewActions.handleEditorChange(value)}
          basicSetup={{ lineNumbers: false, foldGutter: false }}
        />
      ) : (
        <div className="review-preview flex-1 w-full h-full overflow-hidden rounded-lg text-sm font-mono flex flex-col gap-2">
          {comparisonError && (
            <p className="text-xs text-red-100 bg-red-950/40 px-3 py-2 rounded-md">{comparisonError}</p>
          )}
          <CodeMirror
            className="flex-1 w-full h-full overflow-hidden rounded-lg text-sm font-mono"
            value={displayContent}
            height="100%"
            theme={oneDark}
            extensions={[...editorExtensions, ...comparisonExtensions]}
            editable={false}
            readOnly
            basicSetup={{ lineNumbers: true, foldGutter: false }}
          />
        </div>
      )}
    </div>
  );

  return (
    <section className="relative flex flex-col gap-3.5 h-full min-h-0 bg-card border border-border rounded-xl shadow-md p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Review & Apply</p>
          <h2 className="text-xl font-semibold mt-0.5">
            {selectedItem?.file ? (
              <span className="inline-code">{selectedItem.file}</span>
            ) : (
              'Select a file from the left'
            )}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {allApplied && (
            <Button
              variant="outline"
              size="icon"
              type="button"
              onClick={() => updateState({ mode: 'intake' })}
              aria-label="Back to intake"
              title="Back to intake"
            >
              <ArrowLeft />
            </Button>
          )}
          {canEditSelection && (
            <Button
              variant="outline"
              size="icon"
              type="button"
              onClick={() => updateState({ isEditing: !state.isEditing })}
              aria-label={state.isEditing ? 'Switch to preview mode (P)' : 'Switch to edit mode (E)'}
              title={state.isEditing ? 'Switch to preview mode (P)' : 'Switch to edit mode (E)'}
            >
              {state.isEditing ? <Eye /> : <Pencil />}
            </Button>
          )}
          <Button
            variant="outline"
            size="icon"
            type="button"
            onClick={() => updateState({ overlayEditor: 'review' })}
            aria-label="Open review overlay editor"
            title="Open review overlay editor"
          >
            <Maximize2 />
          </Button>
        </div>
      </div>

      {selectedItem?.mode === 'range' && (
        <p className="text-xs text-muted-foreground bg-secondary px-2 py-1.5 rounded-lg border border-border self-start">
          Range anchors remain engine-resolved; this editor is only rendering the canonical comparison output.
        </p>
      )}

      <div className="flex-1 min-h-[320px]">
        {isOverlayActive ? <div className="w-full h-full" /> : editorSurface}
      </div>

      <div className="flex items-center gap-2.5 mt-1 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          type="button"
          onClick={applyActions.handleUndoSelected}
          disabled={!canUndoSelected || isApplyingInProgress || state.isRestoringInProgress}
        >
          Undo Apply
        </Button>
        <Button
          variant="outline"
          size="sm"
          type="button"
          onClick={applyActions.handleUndoAll}
          disabled={!state.canUndoApply || isApplyingInProgress || state.isRestoringInProgress}
        >
          Undo All
        </Button>
        <div className="flex-1" />
        <Button
          variant="outline"
          size="sm"
          type="button"
          onClick={applyActions.handleApplySelected}
          disabled={!canApplySelected}
        >
          {isApplyingInProgress ? 'Applying...' : 'Apply Selected'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          type="button"
          onClick={applyActions.handleApplyValidBlocks}
          disabled={!hasPending || isApplyingInProgress}
        >
          {isApplyingInProgress ? 'Applying...' : 'Apply Valid Blocks'}
        </Button>
        <Button
          type="button"
          onClick={applyActions.handleApplyAll}
          disabled={!hasPending || hasAnyApplied || hasInvalidItems || isApplyingInProgress}
        >
          {isApplyingInProgress ? 'Applying...' : 'Apply All Changes'}
        </Button>
      </div>

      {state.statusMessage && (
        <Badge variant="secondary" className="w-fit">{state.statusMessage}</Badge>
      )}
      {isOverlayActive && typeof document !== 'undefined'
        ? createPortal(
          <div className="fixed inset-0 z-[100] bg-black/60">
            <div className="w-full h-full">
              {editorSurface}
            </div>
          </div>,
          document.body,
        )
        : null}
      {selectedRegion && overlayModel && typeof document !== 'undefined'
        ? createPortal(
          <RegionOverlay
            region={selectedRegion}
            renderRegion={renderModel?.regions.find((region) => region.id === selectedRegion.id) ?? null}
            overlayModel={overlayModel}
            onClose={() => setActiveRegionId(null)}
          />,
          document.body,
        )
        : null}
    </section>
  );
}

function RegionOverlay({
  region,
  renderRegion,
  overlayModel,
  onClose,
}: {
  region: OperationComparisonRegion;
  renderRegion: ReviewRenderableRegion | null;
  overlayModel: ReturnType<typeof buildReviewRegionOverlay>;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[120] bg-black/40 flex items-center justify-center p-4 sm:p-6" onClick={onClose}>
      <div
        className="w-full max-w-6xl max-h-[85vh] min-h-0 rounded-xl border border-border bg-card shadow-2xl p-4 flex flex-col gap-4 overflow-hidden"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 shrink-0">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Local compare</p>
            <h3 className="text-lg font-semibold">{overlayModel.title}</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Region <span className="inline-code">{region.id}</span>
              {renderRegion?.deletedSummary ? ` • ${renderRegion.deletedSummary}` : ''}
            </p>
          </div>
          <Button variant="outline" size="icon" type="button" onClick={onClose} aria-label="Close compare overlay">
            <X />
          </Button>
        </div>

        <div className="grid flex-1 min-h-0 gap-3 md:grid-cols-2">
          <section className="min-h-0 rounded-lg border border-border bg-secondary/40 p-3 flex flex-col">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2 shrink-0">{overlayModel.oldLabel}</p>
            <div className="min-h-0 flex-1 overflow-auto rounded-md">
              <pre className="text-sm whitespace-pre-wrap break-words font-mono">{overlayModel.oldText}</pre>
            </div>
          </section>

          <section className="min-h-0 rounded-lg border border-border bg-secondary/40 p-3 flex flex-col">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2 shrink-0">{overlayModel.newLabel}</p>
            <div className="min-h-0 flex-1 overflow-auto rounded-md">
              <pre className="text-sm whitespace-pre-wrap break-words font-mono">{overlayModel.newText}</pre>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}