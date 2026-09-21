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
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useAppStateContext } from '@/hooks';
import { buildResultReviewModel, buildUnifiedDiffModel } from '@/utils/reviewComparison';
import { cn } from '@/lib/utils';
import { SegmentedControl } from '@/components/ui/segmented-control';
import type { ReviewComparison, ReviewView } from '@/types';

class DeletedRegionWidget extends WidgetType {
  constructor(private readonly regionId: string, private readonly summary: string) { super(); }
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
];

export function ReviewPanel() {
  const { state, updateState } = useAppStateContext();
  const selectedFile = state.reviewFiles.find((file) => file.id === state.selectedReviewFileId) ?? null;
  const [previewEditorView, setPreviewEditorView] = useState<EditorView | null>(null);
  const comparisonData = selectedFile?.comparison ?? null;
  const collapsedHunkIds = selectedFile ? state.collapsedHunkIdsByFile[selectedFile.id] ?? [] : [];
  const collapsedDiffGroupIds = selectedFile ? state.collapsedDiffGroupIdsByFile[selectedFile.id] ?? [] : [];

  const languageExtension = useMemo(() => {
    const fileName = selectedFile?.filePath;
    if (!fileName) return null;
    const extension = fileName.split('.').pop()?.toLowerCase() ?? 'txt';
    switch (extension) {
      case 'ts': case 'tsx': return javascript({ typescript: true, jsx: extension === 'tsx' });
      case 'js': case 'jsx': return javascript({ jsx: extension === 'jsx' });
      case 'json': return json();
      case 'md': case 'markdown': return markdown();
      case 'py': return python();
      case 'html': case 'htm': return html();
      case 'css': case 'scss': case 'sass': return css();
      case 'xml': case 'svg': return xml();
      case 'yml': case 'yaml': return yaml();
      case 'php': case 'phtml': return php();
      default: return javascript();
    }
  }, [selectedFile?.filePath]);

  const editorExtensions = useMemo(
    () => languageExtension ? [indentUnit.of('\t'), languageExtension] : [indentUnit.of('\t')],
    [languageExtension],
  );

  const resultModel = useMemo(() => comparisonData ? buildResultReviewModel(comparisonData) : null, [comparisonData]);
  const unifiedModel = useMemo(() => comparisonData ? buildUnifiedDiffModel(comparisonData) : null, [comparisonData]);
  useEffect(() => {
    updateState({ selectedHunkId: null });
  }, [selectedFile?.id, updateState]);

  useEffect(() => {
    if (!state.selectedHunkId && unifiedModel?.hunks.length) {
      updateState({ selectedHunkId: unifiedModel.hunks[0].sourceHunkIds[0] ?? null });
    }
  }, [state.selectedHunkId, unifiedModel, updateState]);

  useEffect(() => {
    if (!previewEditorView || !resultModel || !state.selectedHunkId || state.reviewView !== 'result') return;
    const active = resultModel.regions.find((region) => region.id === state.selectedHunkId);
    if (!active) return;
    const focusPos = active.highlightStart > 0 ? active.highlightStart : active.anchorOffset;
    previewEditorView.dispatch({ selection: { anchor: focusPos } });
    previewEditorView.dispatch({ effects: EditorView.scrollIntoView(focusPos, { y: 'center' }) });
  }, [previewEditorView, resultModel, state.reviewView, state.selectedHunkId]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!unifiedModel?.hunks.length || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return;
      if (event.key.toLowerCase() !== 'n' && event.key !== 'F7') return;
      const direction = event.shiftKey ? -1 : 1;
      const current = unifiedModel.hunks.findIndex((hunk) => state.selectedHunkId && hunk.sourceHunkIds.includes(state.selectedHunkId));
      const base = current === -1 ? (direction > 0 ? -1 : 0) : current;
      const next = (base + direction + unifiedModel.hunks.length) % unifiedModel.hunks.length;
      updateState({ selectedHunkId: unifiedModel.hunks[next].sourceHunkIds[0] ?? null });
      event.preventDefault();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.selectedHunkId, unifiedModel, updateState]);

  const comparisonExtensions = useMemo(() => {
    if (!resultModel) return [];
    const regionsById = new Map(resultModel.regions.map((region) => [region.id, region]));
    const findRegionAtPosition = (position: number) => resultModel.regions.find((region) => (
      region.highlightEnd > region.highlightStart
        ? position >= region.highlightStart && position < region.highlightEnd
        : position === region.anchorOffset
    )) ?? null;
    const buildDecorations = () => {
      const decorations: Range<Decoration>[] = [];
      resultModel.regions.forEach((region) => {
        const isSelected = region.id === state.selectedHunkId;
        if (region.highlightEnd > region.highlightStart) {
          decorations.push(Decoration.mark({ attributes: { class: isSelected ? 'cm-review-region cm-review-region-selected' : 'cm-review-region', 'data-review-region-id': region.id } }).range(region.highlightStart, region.highlightEnd));
        }
        if (region.kind === 'delete' && region.deletedSummary) {
          decorations.push(Decoration.widget({ widget: new DeletedRegionWidget(region.id, region.deletedSummary), side: region.anchorSide === 'after' ? 1 : -1, block: false }).range(region.anchorOffset, region.anchorOffset));
        }
      });
      resultModel.windows.forEach((window) => {
        if (window.end > window.start) decorations.push(Decoration.mark({ attributes: { class: 'cm-review-window' } }).range(window.start, window.end));
      });
      return Decoration.set(decorations, true);
    };
    const comparisonField = StateField.define({
      create: buildDecorations,
      update(decorations, transaction) { return transaction.docChanged ? buildDecorations() : decorations; },
      provide: (field) => EditorView.decorations.from(field),
    });
    const comparisonTheme = EditorView.theme({
      '.cm-review-region': { backgroundColor: 'rgba(59, 130, 246, 0.16)', borderRadius: '0.2rem', cursor: 'pointer' },
      '.cm-review-window': { backgroundColor: 'rgba(148, 163, 184, 0.08)', outline: '1px dashed rgba(148, 163, 184, 0.20)' },
      '.cm-review-region-selected': { backgroundColor: 'rgba(96, 165, 250, 0.3)', outline: '1px solid rgba(96, 165, 250, 0.45)' },
      '.cm-review-deleted-widget': { margin: '0 0.4rem', padding: '0.125rem 0.5rem', borderRadius: '9999px', border: '1px dashed rgba(248, 113, 113, 0.55)', backgroundColor: 'rgba(127, 29, 29, 0.25)', color: 'rgb(254, 202, 202)', fontSize: '0.75rem', lineHeight: '1.2', cursor: 'pointer' },
    });
    const interactionExtension = EditorView.domEventHandlers({
      mousedown: (event, view) => {
        const target = event.target as HTMLElement | null;
        const directRegionId = target?.closest('[data-review-region-id]')?.getAttribute('data-review-region-id');
        if (directRegionId && regionsById.has(directRegionId)) { updateState({ selectedHunkId: directRegionId }); return true; }
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

  if (!selectedFile || !comparisonData) {
    return <div className="flex h-full min-h-0 items-center justify-center text-sm text-muted-foreground">Select a change from the left pane.</div>;
  }

  const setCollapsedHunks = (ids: string[]) => updateState((prev) => ({ collapsedHunkIdsByFile: { ...prev.collapsedHunkIdsByFile, [selectedFile.id]: ids } }));
  const setCollapsedGroups = (ids: string[]) => updateState((prev) => ({ collapsedDiffGroupIdsByFile: { ...prev.collapsedDiffGroupIdsByFile, [selectedFile.id]: ids } }));

  return (
    <section className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex h-10 items-center justify-between gap-3 border-b border-border bg-card px-3">
        <span className="inline-code max-w-[60vw] truncate" title={selectedFile.filePath}>{selectedFile.filePath}</span>
        <SegmentedControl options={reviewViewOptions} value={state.reviewView} onChange={(value) => updateState({ reviewView: value })} />
        {state.reviewView === 'unified' && unifiedModel && unifiedModel.hunks.length > 0 && (
          <div className="flex items-center gap-1">
            <button type="button" className="h-7 rounded-md px-2 text-xs font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground" onClick={() => setCollapsedHunks(unifiedModel.hunks.map((hunk) => hunk.id))}>Collapse All</button>
            <button type="button" className="h-7 rounded-md px-2 text-xs font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground" onClick={() => setCollapsedHunks([])}>Expand All</button>
          </div>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        {state.reviewView === 'result' && (
          <div className="review-preview h-full w-full overflow-hidden text-sm font-mono">
            <CodeMirror className="h-full w-full overflow-hidden text-sm font-mono" value={comparisonData.newContent} height="100%" theme={oneDark} extensions={[...editorExtensions, ...comparisonExtensions]} editable={false} readOnly basicSetup={{ lineNumbers: true, foldGutter: false }} onCreateEditor={setPreviewEditorView} />
          </div>
        )}
        {state.reviewView === 'unified' && (
          <UnifiedDiffView
            model={unifiedModel}
            selectedHunkId={state.selectedHunkId}
            collapsedHunkIds={collapsedHunkIds}
            collapsedDiffGroupIds={collapsedDiffGroupIds}
            onSelectHunk={(hunkId) => updateState({ selectedHunkId: hunkId })}
            onToggleHunk={(hunkId) => setCollapsedHunks(collapsedHunkIds.includes(hunkId) ? collapsedHunkIds.filter((id) => id !== hunkId) : [...collapsedHunkIds, hunkId])}
            onToggleGroup={(groupId) => setCollapsedGroups(collapsedDiffGroupIds.includes(groupId) ? collapsedDiffGroupIds.filter((id) => id !== groupId) : [...collapsedDiffGroupIds, groupId])}
          />
        )}
      </div>
    </section>
  );
}

export function UnifiedDiffView({ model, selectedHunkId, collapsedHunkIds, collapsedDiffGroupIds, onSelectHunk, onToggleHunk, onToggleGroup }: {
  model: ReturnType<typeof buildUnifiedDiffModel> | null;
  selectedHunkId: string | null;
  collapsedHunkIds: string[];
  collapsedDiffGroupIds: string[];
  onSelectHunk: (hunkId: string) => void;
  onToggleHunk: (hunkId: string) => void;
  onToggleGroup: (groupId: string) => void;
}) {
  if (!model) return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading comparison...</div>;
  if (model.hunks.length === 0) return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No diff hunks for this change.</div>;
  return (
    <div className="h-full overflow-auto bg-[#111827] font-mono text-xs text-slate-200"><div className="min-w-max py-2">
      {model.hunks.map((hunk) => {
        const isCollapsed = collapsedHunkIds.includes(hunk.id);
        const isSelected = selectedHunkId ? hunk.sourceHunkIds.includes(selectedHunkId) : false;
        return <div key={hunk.id}>
          <button type="button" onClick={() => { const first = hunk.sourceHunkIds[0]; if (first) onSelectHunk(first); onToggleHunk(hunk.id); }} className={cn('grid w-full grid-cols-[2rem_4rem_4rem_minmax(12rem,1fr)_10rem] items-center bg-slate-800/90 text-left leading-7 text-sky-200 hover:bg-slate-700/90', isSelected && 'outline outline-1 outline-inset outline-sky-500/70')}>
            <span className="flex items-center justify-center text-slate-400">{isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}</span><span className="px-2 text-right text-slate-500">{hunk.oldStartLine}</span><span className="px-2 text-right text-slate-500">{hunk.newStartLine}</span><span className="truncate px-2">{hunk.header}</span><span className="px-2 text-right text-[11px] text-slate-400">{hunk.removedCount} removed, {hunk.addedCount} added</span>
          </button>
          {!isCollapsed && hunk.segments.map((segment) => segment.kind === 'context' ? <ContextLineGroup key={segment.id} groupId={segment.id} label={segment.label} rows={segment.rows} isCollapsed={collapsedDiffGroupIds.includes(segment.id)} selectedHunkId={selectedHunkId} onSelectHunk={onSelectHunk} onToggleGroup={onToggleGroup} /> : <DiffLineGroup key={segment.id} groupId={segment.id} label={segment.kind === 'remove' ? 'removed' : 'added'} count={segment.rows.length} rows={segment.rows} isCollapsed={collapsedDiffGroupIds.includes(segment.id)} selectedHunkId={selectedHunkId} onSelectHunk={onSelectHunk} onToggleGroup={onToggleGroup} />)}
        </div>;
      })}
    </div></div>
  );
}

function ContextLineGroup({ groupId, label, rows, isCollapsed, selectedHunkId, onSelectHunk, onToggleGroup }: { groupId: string; label: string; rows: ReturnType<typeof buildUnifiedDiffModel>['hunks'][number]['rows']; isCollapsed: boolean; selectedHunkId: string | null; onSelectHunk: (hunkId: string) => void; onToggleGroup: (groupId: string) => void; }) {
  if (rows.length === 0) return null;
  return <div><button type="button" onClick={() => onToggleGroup(groupId)} className="grid w-full grid-cols-[2rem_4rem_4rem_2rem_minmax(0,1fr)] items-center bg-slate-900/80 text-left leading-6 text-slate-300"><span className="flex items-center justify-center text-slate-500">{isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}</span><span /><span /><span className="text-slate-500"> </span><span className="px-2 text-[11px] text-slate-400">{rows.length} {label}</span></button>{!isCollapsed && <DiffRows rows={rows} selectedHunkId={selectedHunkId} onSelectHunk={onSelectHunk} />}</div>;
}

function DiffLineGroup({ groupId, label, count, rows, isCollapsed, selectedHunkId, onSelectHunk, onToggleGroup }: { groupId: string; label: 'removed' | 'added'; count: number; rows: ReturnType<typeof buildUnifiedDiffModel>['hunks'][number]['rows']; isCollapsed: boolean; selectedHunkId: string | null; onSelectHunk: (hunkId: string) => void; onToggleGroup: (groupId: string) => void; }) {
  if (count === 0) return null;
  const canFold = count > 1;
  return <div>{canFold && <button type="button" onClick={() => onToggleGroup(groupId)} className={cn('grid w-full grid-cols-[2rem_4rem_4rem_2rem_minmax(0,1fr)] items-center text-left leading-6', label === 'removed' ? 'bg-red-950/45 text-red-100' : 'bg-emerald-950/45 text-emerald-100')}><span className="flex items-center justify-center text-slate-400">{isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}</span><span /><span /><span className="text-slate-400">{label === 'removed' ? '-' : '+'}</span><span className="px-2 text-[11px] text-slate-300">{count} {label}</span></button>}{(!canFold || !isCollapsed) && <DiffRows rows={rows} selectedHunkId={selectedHunkId} onSelectHunk={onSelectHunk} />}</div>;
}

function DiffRows({ rows, selectedHunkId, onSelectHunk }: { rows: ReturnType<typeof buildUnifiedDiffModel>['hunks'][number]['rows']; selectedHunkId: string | null; onSelectHunk: (hunkId: string) => void; }) {
  return <>{rows.map((row) => <button type="button" key={row.id} onClick={() => onSelectHunk(row.hunkId)} className={cn('grid w-full grid-cols-[4rem_4rem_2rem_minmax(0,1fr)] items-start text-left leading-5', row.kind === 'context' && 'bg-slate-950/55 text-slate-300', row.kind === 'remove' && 'bg-red-950/35 text-red-100', row.kind === 'add' && 'bg-emerald-950/35 text-emerald-100', selectedHunkId === row.hunkId && 'outline outline-1 outline-inset outline-sky-500/50')}><span className="px-2 text-right text-slate-500">{row.oldLine ?? ''}</span><span className="px-2 text-right text-slate-500">{row.newLine ?? ''}</span><span className="px-2 text-slate-400">{row.marker}</span><span className="whitespace-pre px-2">{row.text || ' '}</span></button>)}</>;
}
