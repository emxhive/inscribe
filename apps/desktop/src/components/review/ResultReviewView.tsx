import { useEffect, useMemo, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { Decoration, EditorView, WidgetType } from '@codemirror/view';
import { indentUnit } from '@codemirror/language';
import { type Range, StateField } from '@codemirror/state';
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
import { buildResultReviewModel } from '@/utils/reviewComparison';
import type { ReviewComparison } from '@/types';

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

type ResultReviewViewProps = {
  filePath: string;
  comparisonData: ReviewComparison;
  selectedHunkId: string | null;
  onSelectHunk: (hunkId: string) => void;
};

export function ResultReviewView({
  filePath,
  comparisonData,
  selectedHunkId,
  onSelectHunk,
}: ResultReviewViewProps) {
  const [previewEditorView, setPreviewEditorView] =
    useState<EditorView | null>(null);

  const languageExtension = useMemo(() => {
    const extension = filePath.split('.').pop()?.toLowerCase() ?? 'txt';

    switch (extension) {
      case 'ts':
      case 'tsx':
        return javascript({
          typescript: true,
          jsx: extension === 'tsx',
        });

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

      default:
        return javascript();
    }
  }, [filePath]);

  const editorExtensions = useMemo(
    () => [indentUnit.of('\t'), languageExtension],
    [languageExtension],
  );

  const resultModel = useMemo(
    () => buildResultReviewModel(comparisonData),
    [comparisonData],
  );

  useEffect(() => {
    if (!previewEditorView || !resultModel || !selectedHunkId) {
      return;
    }

    const active = resultModel.regions.find(
      (region) => region.id === selectedHunkId,
    );

    if (!active) return;

    const focusPos =
      active.highlightStart > 0
        ? active.highlightStart
        : active.anchorOffset;

    previewEditorView.dispatch({
      selection: { anchor: focusPos },
    });

    previewEditorView.dispatch({
      effects: EditorView.scrollIntoView(focusPos, {
        y: 'center',
      }),
    });
  }, [previewEditorView, resultModel, selectedHunkId]);

  const comparisonExtensions = useMemo(() => {
    if (!resultModel) return [];

    const regionsById = new Map(
      resultModel.regions.map((region) => [region.id, region]),
    );

    const findRegionAtPosition = (position: number) =>
      resultModel.regions.find((region) =>
        region.highlightEnd > region.highlightStart
          ? position >= region.highlightStart &&
            position < region.highlightEnd
          : position === region.anchorOffset,
      ) ?? null;

    const buildDecorations = () => {
      const decorations: Range<Decoration>[] = [];

      resultModel.regions.forEach((region) => {
        const isSelected = region.id === selectedHunkId;

        if (region.highlightEnd > region.highlightStart) {
          decorations.push(
            Decoration.mark({
              attributes: {
                class: isSelected
                  ? 'cm-review-region cm-review-region-selected'
                  : 'cm-review-region',
                'data-review-region-id': region.id,
              },
            }).range(
              region.highlightStart,
              region.highlightEnd,
            ),
          );
        }

        if (region.kind === 'delete' && region.deletedSummary) {
          decorations.push(
            Decoration.widget({
              widget: new DeletedRegionWidget(
                region.id,
                region.deletedSummary,
              ),
              side: region.anchorSide === 'after' ? 1 : -1,
              block: false,
            }).range(
              region.anchorOffset,
              region.anchorOffset,
            ),
          );
        }
      });

      resultModel.windows.forEach((window) => {
        if (window.end > window.start) {
          decorations.push(
            Decoration.mark({
              attributes: {
                class: 'cm-review-window',
              },
            }).range(window.start, window.end),
          );
        }
      });

      return Decoration.set(decorations, true);
    };

    const comparisonField = StateField.define({
      create: buildDecorations,
      update(decorations, transaction) {
        return transaction.docChanged
          ? buildDecorations()
          : decorations;
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

        const directRegionId = target
          ?.closest('[data-review-region-id]')
          ?.getAttribute('data-review-region-id');

        if (
          directRegionId &&
          regionsById.has(directRegionId)
        ) {
          onSelectHunk(directRegionId);
          return true;
        }

        const position = view.posAtCoords({
          x: event.clientX,
          y: event.clientY,
        });

        if (position === null) return false;

        const region = findRegionAtPosition(position);

        if (!region) return false;

        onSelectHunk(region.id);
        return true;
      },
    });

    return [
      comparisonTheme,
      comparisonField,
      interactionExtension,
    ];
  }, [onSelectHunk, resultModel, selectedHunkId]);

  return (
    <div className="review-preview h-full w-full overflow-hidden text-sm font-mono">
      <CodeMirror
        className="h-full w-full overflow-hidden text-sm font-mono"
        value={comparisonData.newContent}
        height="100%"
        theme={oneDark}
        extensions={[
          ...editorExtensions,
          ...comparisonExtensions,
        ]}
        editable={false}
        readOnly
        basicSetup={{
          lineNumbers: true,
          foldGutter: false,
        }}
        onCreateEditor={setPreviewEditorView}
      />
    </div>
  );
}