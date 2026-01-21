import React, { useEffect, useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { keymap } from '@codemirror/view';
import { indentWithTab } from '@codemirror/commands';
import { indentUnit } from '@codemirror/language';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { python } from '@codemirror/lang-python';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { xml } from '@codemirror/lang-xml';
import { yaml } from '@codemirror/lang-yaml';
import { oneDark } from '@codemirror/theme-one-dark';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAppStateContext, useApplyActions, useReviewActions } from '@/hooks';
import { AlertCircle, ArrowLeft, Eye, Pencil } from 'lucide-react';

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

  const languageExtension = useMemo(() => {
    const fileName = selectedItem?.file;
    if (!fileName) {
      return null;
    }
    const extension = fileName.split('.').pop()?.toLowerCase();
    if (!extension) {
      return null;
    }
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
      default:
        return null;
    }
  }, [selectedItem?.file]);

  const editorExtensions = useMemo(() => {
    const baseExtensions = [indentUnit.of('\t'), keymap.of([indentWithTab])];
    if (languageExtension) {
      baseExtensions.push(languageExtension);
    }
    return baseExtensions;
  }, [languageExtension]);

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

      <div className="flex-1 min-h-[320px] border border-border rounded-lg p-3 bg-secondary flex">
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
        )}
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
    </section>
  );
}
