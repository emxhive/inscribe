import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import CodeMirror from '@uiw/react-codemirror';
import { Decoration, EditorView, GutterMarker, gutter, keymap } from '@codemirror/view';
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
import { AlertCircle, ArrowLeft, Eye, Maximize2, Pencil } from 'lucide-react';
import type { OperationPreview, Operation } from '@inscribe/shared';

type PreviewLineMarker = 'insert' | 'remove' | null;

class DiffGutterMarker extends GutterMarker {
  constructor(private readonly marker: string, private readonly className: string) {
    super();
  }

  toDOM() {
    const element = document.createElement('span');
    element.textContent = this.marker;
    element.className = this.className;
    return element;
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
  const [previewData, setPreviewData] = useState<OperationPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
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

    const loadPreview = async () => {
      if (!state.repoRoot || !selectedItem || isEditing) {
        setPreviewData(null);
        setPreviewError(null);
        return;
      }

      if (selectedItem.mode !== 'append' && selectedItem.mode !== 'range') {
        setPreviewData(null);
        setPreviewError(null);
        return;
      }

      const operation: Operation = {
        type: selectedItem.mode,
        file: selectedItem.file,
        content: editorValue,
        directives: selectedItem.directives,
      };

      try {
        const result = await window.inscribeAPI.previewOperation(operation, state.repoRoot);
        if (cancelled) return;
        if ('error' in result) {
          setPreviewData(null);
          setPreviewError(result.error);
          return;
        }
        setPreviewData(result);
        setPreviewError(null);
      } catch (error) {
        if (cancelled) return;
        setPreviewData(null);
        setPreviewError(error instanceof Error ? error.message : 'Failed to load preview');
      }
    };

    void loadPreview();

    return () => {
      cancelled = true;
    };
  }, [
    editorValue,
    isEditing,
    selectedItem,
    state.repoRoot,
  ]);

  const previewSections = useMemo(() => {
    if (!previewData) return null;

    const contextLines = 20;
    const contentLines = previewData.content.split('\n');
    const lineStarts: number[] = [];
    let offset = 0;
    for (const line of contentLines) {
      lineStarts.push(offset);
      offset += line.length + 1;
    }

    const findLineIndex = (position: number) => {
      for (let i = lineStarts.length - 1; i >= 0; i -= 1) {
        if (lineStarts[i] <= position) {
          return i;
        }
      }
      return 0;
    };

    const safeEnd = Math.max(previewData.replaceEnd - 1, previewData.replaceStart);
    const startLine = findLineIndex(previewData.replaceStart);
    const endLine = findLineIndex(safeEnd);
    const beforeStart = Math.max(0, startLine - contextLines);
    const afterEnd = Math.min(contentLines.length - 1, endLine + contextLines);
    const before = contentLines.slice(beforeStart, startLine).join('\n');
    const after = contentLines.slice(endLine + 1, afterEnd + 1).join('\n');
    const sections: Array<{ text: string; marker: PreviewLineMarker }> = [];
    if (before) {
      sections.push({ text: before, marker: null });
    }
    if (previewData.type === 'range' && previewData.removed) {
      sections.push({ text: previewData.removed, marker: 'remove' });
    }
    if (previewData.insert) {
      sections.push({ text: previewData.insert, marker: 'insert' });
    }
    if (after) {
      sections.push({ text: after, marker: null });
    }

    let unifiedContent = sections.map((section) => section.text).filter(Boolean).join('\n');
    const lineMeta: PreviewLineMarker[] = [];
    sections.forEach((section) => {
      if (!section.text) {
        return;
      }
      section.text.split('\n').forEach(() => {
        lineMeta.push(section.marker);
      });
    });

    const selectedExtension = selectedItem?.file?.split('.').pop()?.toLowerCase();
    const shouldPrependPhpTag =
      (selectedExtension === 'php' || selectedExtension === 'phtml') &&
      !unifiedContent.startsWith('<?php');
    if (shouldPrependPhpTag) {
      unifiedContent = `<?php\n${unifiedContent}`;
      lineMeta.unshift(null);
    }

    return {
      before,
      after,
      removed: previewData.removed,
      insert: previewData.insert,
      mode: previewData.type,
      unifiedContent,
      lineMeta,
    };
  }, [previewData, selectedItem?.file]);

  const previewExtensions = useMemo(() => {
    if (!previewSections?.lineMeta?.length) {
      return [];
    }

    const insertMarker = new DiffGutterMarker(
      '+',
      'cm-review-preview-gutter-marker cm-review-preview-gutter-insert',
    );
    const removeMarker = new DiffGutterMarker(
      '-',
      'cm-review-preview-gutter-marker cm-review-preview-gutter-remove',
    );
    const lineMeta = previewSections.lineMeta;
    const diffGutter = gutter({
      class: 'cm-review-preview-gutter',
      lineMarker(view, line) {
        const index = view.state.doc.lineAt(line.from).number - 1;
        const marker = lineMeta[index];
        if (marker === 'insert') {
          return insertMarker;
        }
        if (marker === 'remove') {
          return removeMarker;
        }
        return null;
      },
    });

    const insertLineDecoration = Decoration.line({ attributes: { class: 'cm-review-preview-line-insert' } });
    const removeLineDecoration = Decoration.line({ attributes: { class: 'cm-review-preview-line-remove' } });
    const buildLineDecorations = (state: EditorState) => {
      const builder = new RangeSetBuilder<Decoration>();
      for (let lineNumber = 1; lineNumber <= state.doc.lines; lineNumber += 1) {
        const marker = lineMeta[lineNumber - 1];
        if (!marker) {
          continue;
        }
        const line = state.doc.line(lineNumber);
        builder.add(line.from, line.from, marker === 'insert' ? insertLineDecoration : removeLineDecoration);
      }
      return builder.finish();
    };
    const diffLineField = StateField.define({
      create: buildLineDecorations,
      update(decorations, transaction) {
        if (transaction.docChanged) {
          return buildLineDecorations(transaction.state);
        }
        return decorations;
      },
      provide: (field) => EditorView.decorations.from(field),
    });

    const diffTheme = EditorView.theme({
      '.cm-review-preview-line-insert': {
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
      },
      '.cm-review-preview-line-remove': {
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
      },
      '.cm-review-preview-gutter-marker': {
        display: 'inline-block',
        width: '1.25rem',
        textAlign: 'center',
        fontWeight: '600',
      },
      '.cm-review-preview-gutter-insert': {
        color: 'rgb(59, 130, 246)',
      },
      '.cm-review-preview-gutter-remove': {
        color: 'rgb(239, 68, 68)',
      },
    });

    return [diffTheme, diffGutter, diffLineField];
  }, [previewSections]);

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
    if (!isOverlayActive) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }
      updateState({ overlayEditor: null });
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOverlayActive, updateState]);

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
    <div className="flex-1 w-full h-full border border-border rounded-lg p-3 bg-secondary flex">
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
      ) : previewSections && (selectedItem?.mode === 'append' || selectedItem?.mode === 'range') ? (
        <div className="review-preview flex-1 w-full h-full overflow-hidden rounded-lg text-sm font-mono">
          {previewError && (
            <p className="text-xs text-red-200 px-3 py-2">{previewError}</p>
          )}
          <CodeMirror
            className="flex-1 w-full h-full overflow-hidden rounded-lg text-sm font-mono"
            value={previewSections.unifiedContent}
            height="100%"
            theme={oneDark}
            extensions={[...editorExtensions, ...previewExtensions]}
            editable={false}
            readOnly
            basicSetup={{ lineNumbers: true, foldGutter: false }}
          />
        </div>
      ) : (
        <div className="flex-1 w-full h-full overflow-hidden rounded-lg text-sm font-mono flex flex-col gap-2">
          {previewError && (
            <p className="text-xs text-red-200">{previewError}</p>
          )}
          <CodeMirror
            className="flex-1 w-full h-full overflow-hidden rounded-lg text-sm font-mono"
            value={editorValue}
            height="100%"
            theme={oneDark}
            extensions={editorExtensions}
            editable={false}
            readOnly
            basicSetup={{ lineNumbers: false, foldGutter: false }}
          />
        </div>
      )}
    </div>
  );

  return (
    <section className="flex flex-col gap-3.5 h-full min-h-0 bg-card border border-border rounded-xl shadow-md p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Review & Apply</p>
          <h2 className="text-xl font-semibold mt-0.5">{selectedItem?.file || 'Select a file from the left'}</h2>
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

      {selectedItem?.validationError && (
        <div className="bg-red-50 border border-red-200 text-red-900 px-4 py-3 rounded-md text-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <strong>Validation Error:</strong> {selectedItem.validationError}
          </div>
        </div>
      )}

      {selectedItem?.mode === 'range' && (
        <p className="text-xs text-muted-foreground bg-secondary px-2 py-1.5 rounded-lg border border-border self-start">
          Range anchors must match exactly and be unique; omit END to replace the START-selected line with your block.
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
          onClick={applyActions.handleUndo}
          title="Undo last apply (single-step)"
          disabled={isApplyingInProgress}
        >
          Undo last apply
        </Button>
        <Button
          variant="outline"
          size="sm"
          type="button"
          onClick={applyActions.handleRedo}
          disabled={!state.canRedo || isApplyingInProgress}
        >
          Redo Apply
        </Button>
        <Button 
          variant="outline" 
          size="sm"
          type="button" 
          onClick={reviewActions.handleResetAll} 
          disabled={isApplyingInProgress}
        >
          Reset All
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
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-5xl h-[calc(100vh-2rem)]">
              {editorSurface}
            </div>
          </div>,
          document.body,
        )
        : null}
    </section>
  );
}
