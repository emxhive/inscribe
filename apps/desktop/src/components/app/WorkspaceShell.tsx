import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Folder,
  History,
  Info,
  Loader2,
  RotateCcw,
  Settings,
} from 'lucide-react';
import { DIRECTIVE_KEYS, HEADER_KEYS, VALID_MODES, type DirectiveKey, type HeaderKey } from '@inscribe/shared';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { FileListEntry } from '@/components/common/FileListEntry';
import { useAppStateContext, useApplyActions, useHistoryActions, useIntakeBlocks, useParsingActions, useRepositoryActions, useReviewActions } from '@/hooks';
import { getLanguageFromFilename, getPathBasename, toSentenceCase } from '@/utils';
import { updateDirectiveInText } from '@/utils/intake';
import { FileSidebar, MAX_SIDEBAR_WIDTH, MIN_SIDEBAR_WIDTH } from './FileSidebar';
import { IntakePanel } from './IntakePanel';
import { ReviewPanel } from './ReviewPanel';
import { HeaderDirectiveEditor } from './HeaderDirectiveEditor';
import { cn } from '@/lib/utils';

type WorkspaceShellProps = {
  onOpenScopeModal: () => void;
  onOpenIgnore: () => void;
  onOpenIndexedList: () => void;
};

export function WorkspaceShell({
  onOpenScopeModal,
  onOpenIgnore,
  onOpenIndexedList,
}: WorkspaceShellProps) {
  const { state, updateState } = useAppStateContext();
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    if (typeof window === 'undefined') return 280;
    const stored = window.localStorage.getItem('inscribe:intake:sidebarWidth');
    const parsed = stored ? Number(stored) : 280;
    if (!Number.isFinite(parsed)) return 280;
    return Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, parsed));
  });

  const handleSidebarResize = (width: number, options?: { persist?: boolean }) => {
    const clamped = Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, width));
    setSidebarWidth(clamped);
    if (options?.persist && typeof window !== 'undefined') {
      window.localStorage.setItem('inscribe:intake:sidebarWidth', String(clamped));
    }
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <WorkspaceTopBar
        onOpenScopeModal={onOpenScopeModal}
        onOpenIgnore={onOpenIgnore}
        onOpenIndexedList={onOpenIndexedList}
      />
      <div
        className="grid min-h-0 flex-1 overflow-hidden"
        style={{ gridTemplateColumns: `${sidebarWidth}px minmax(0,1fr) 336px` }}
      >
        <FileSidebar sidebarWidth={sidebarWidth} onResize={handleSidebarResize} />
        <main className="min-h-0 overflow-hidden">
          {state.isRestoringRepo && (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Restoring last repository...
            </div>
          )}
          {!state.isRestoringRepo && state.mode === 'intake' && <IntakePanel />}
          {!state.isRestoringRepo && state.mode === 'review' && <ReviewPanel />}
        </main>
        <RightPanel />
      </div>
      <WorkspaceBottomBar />
    </div>
  );
}

function WorkspaceTopBar({
  onOpenScopeModal,
  onOpenIgnore,
  onOpenIndexedList,
}: WorkspaceShellProps) {
  const { state, updateState } = useAppStateContext();
  const repositoryActions = useRepositoryActions();
  const repoName = getPathBasename(state.repoRoot || '');
  const hasRepository = Boolean(state.repoRoot);
  const [recentProjects, setRecentProjects] = useState<string[]>([]);
  const [showRecent, setShowRecent] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.inscribeAPI.getRecentProjects().then(setRecentProjects);
    return window.inscribeAPI.onRecentProjectsUpdated(setRecentProjects);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowRecent(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const requireRepository = (action: () => void, message: string) => {
    if (!hasRepository) {
      updateState({ statusMessage: message });
      return;
    }
    action();
  };

  const handleRecentClick = (path: string) => {
    window.inscribeAPI.openRepository(path);
    setShowRecent(false);
  };

  return (
    <header className="relative z-50 flex h-11 flex-shrink-0 items-center gap-2 border-b border-border bg-card px-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className="text-sm font-semibold">Inscribe</span>
        <span className="h-4 w-px bg-border" />
        <span className="w-32 truncate text-xs font-semibold text-foreground" title={repoName || 'Repository'}>
          {repoName || 'Repository'}
        </span>
        <div className="relative flex items-center">
          <input
            className="h-7 w-80 rounded-md border border-input bg-secondary px-2 text-xs font-medium text-foreground placeholder:text-muted-foreground focus:outline-none"
            value={state.repoRoot || ''}
            readOnly
            placeholder="No repository selected"
            title={state.repoRoot || ''}
          />
          {recentProjects.length > 0 && (
            <button
              className="absolute right-1.5 rounded-sm p-1 hover:bg-accent hover:text-accent-foreground"
              onClick={() => setShowRecent(!showRecent)}
              title="Recent projects"
              type="button"
            >
              <Clock className="h-3.5 w-3.5" />
            </button>
          )}
          {showRecent && (
            <div
              ref={dropdownRef}
              className="absolute left-0 top-full z-[100] mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-border bg-popover py-1 shadow-lg"
            >
              <div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Recent Projects
              </div>
              {recentProjects.map((path) => (
                <button
                  key={path}
                  className="w-full truncate px-3 py-2 text-left text-xs hover:bg-accent hover:text-accent-foreground"
                  onClick={() => handleRecentClick(path)}
                  title={path}
                  type="button"
                >
                  <div className="truncate font-medium">{getPathBasename(path)}</div>
                  <div className="truncate text-[10px] text-muted-foreground">{path}</div>
                </button>
              ))}
            </div>
          )}
        </div>
        <Button
          variant="outline"
          size="icon"
          type="button"
          className="h-7 w-7"
          title="Browse for repository"
          aria-label="Browse for repository"
          onClick={repositoryActions.handleBrowseRepo}
        >
          <Folder className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="ml-auto flex items-center gap-1">
        <ChromeButton active={state.mode === 'intake'} onClick={() => updateState({ mode: 'intake' })}>
          Intake
        </ChromeButton>
        <ChromeButton
          active={state.mode === 'review'}
          onClick={() => updateState({ mode: 'review' })}
          disabled={state.reviewItems.length === 0}
        >
          Review
        </ChromeButton>
        <span className="mx-1 h-4 w-px bg-border" />
        <ChromeButton disabled={!hasRepository} onClick={() => requireRepository(onOpenScopeModal, 'Select a repository to configure scope.')}>
          Scope {state.scope.length}
        </ChromeButton>
        <ChromeButton disabled={!hasRepository} onClick={() => requireRepository(onOpenIgnore, 'Select a repository to edit ignore rules.')}>
          Ignore {state.ignore.entries.length}
        </ChromeButton>
        <ChromeButton onClick={onOpenIndexedList}>Indexed {state.indexedCount}</ChromeButton>
        <ChromeButton
          active={state.rightPanelView === 'history'}
          onClick={() => updateState({ rightPanelView: state.rightPanelView === 'history' ? 'inspector' : 'history' })}
          title="History"
        >
          <History className="h-3.5 w-3.5" />
        </ChromeButton>
        <ChromeButton onClick={() => updateState({ statusMessage: 'Settings (placeholder)' })} title="Settings">
          <Settings className="h-3.5 w-3.5" />
        </ChromeButton>
        <ChromeButton onClick={() => updateState({ statusMessage: 'Info (placeholder)' })} title="Info">
          <Info className="h-3.5 w-3.5" />
        </ChromeButton>
      </div>
    </header>
  );
}

function WorkspaceBottomBar() {
  const { state, updateState } = useAppStateContext();
  const { handleParseBlocks } = useParsingActions();
  const applyActions = useApplyActions();
  const selectedItem = state.reviewItems.find((item) => item.id === state.selectedItemId) ?? null;
  const hasInvalidItems = state.reviewItems.some((item) => item.status === 'invalid');
  const hasAnyApplied = state.reviewItems.some((item) => item.status === 'applied');
  const hasPending = state.reviewItems.some((item) => item.status === 'pending');
  const selectedIsApplied = selectedItem?.status === 'applied';
  const canApplySelected = Boolean(selectedItem) && selectedItem?.status === 'pending' && !state.isApplyingInProgress;
  const canUndoSelected =
    Boolean(selectedItem) &&
    selectedIsApplied &&
    state.historyItems.some(
      (item) => item.file === selectedItem?.file && item.blockIndex === selectedItem?.blockIndex && !item.restoredAt,
    );
  const selectedHunkIndex = state.selectedHunkId
    ? Math.max(0, state.reviewItems.findIndex((item) => item.id === state.selectedItemId))
    : -1;

  const statusIcon = (() => {
    switch (state.pipelineStatus) {
      case 'parsing':
      case 'applying':
        return <Loader2 className="h-3.5 w-3.5 animate-spin" />;
      case 'parse-success':
      case 'apply-success':
        return <CheckCircle2 className="h-3.5 w-3.5" />;
      case 'parse-failure':
      case 'apply-failure':
        return <AlertCircle className="h-3.5 w-3.5 text-destructive" />;
      default:
        if (state.indexStatus.state === 'error') return <AlertCircle className="h-3.5 w-3.5 text-destructive" />;
        return null;
    }
  })();

  const statusText = state.statusMessage || toSentenceCase(state.indexStatus.state);

  return (
    <footer className="flex h-10 flex-shrink-0 items-center gap-2 border-t border-border bg-card px-3">
      <div className="flex min-w-0 flex-1 items-center gap-2 text-xs text-muted-foreground">
        {statusIcon}
        <span className="truncate" title={statusText}>{statusText}</span>
      </div>

      {state.mode === 'intake' && (
        <Button
          type="button"
          size="sm"
          onClick={handleParseBlocks}
          disabled={!state.repoRoot || state.isParsingInProgress}
          title={!state.repoRoot ? 'Select a repository first' : state.isParsingInProgress ? 'Parsing in progress...' : ''}
        >
          {state.isParsingInProgress ? 'Parsing...' : 'Parse Code Blocks'}
        </Button>
      )}

      {state.mode === 'review' && (
        <>
          <span className="text-xs text-muted-foreground">
            {selectedHunkIndex >= 0 ? 'Hunk selected' : 'N / Shift+N navigates hunks'}
          </span>
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={applyActions.handleUndoSelected}
            disabled={!canUndoSelected || state.isApplyingInProgress || state.isRestoringInProgress}
          >
            Undo Selected
          </Button>
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={applyActions.handleUndoAll}
            disabled={!state.canUndoApply || state.isApplyingInProgress || state.isRestoringInProgress}
          >
            Undo All
          </Button>
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={applyActions.handleApplySelected}
            disabled={!canApplySelected}
          >
            {state.isApplyingInProgress ? 'Applying...' : 'Apply Selected'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={applyActions.handleApplyValidBlocks}
            disabled={!hasPending || state.isApplyingInProgress}
          >
            Apply Valid
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={applyActions.handleApplyAll}
            disabled={!hasPending || hasAnyApplied || hasInvalidItems || state.isApplyingInProgress}
          >
            Apply All
          </Button>
          {state.reviewItems.length > 0 && state.reviewItems.every((item) => item.status === 'applied') && (
            <Button variant="outline" size="sm" type="button" onClick={() => updateState({ mode: 'intake' })}>
              Back to Intake
            </Button>
          )}
        </>
      )}
    </footer>
  );
}

function RightPanel() {
  const { state } = useAppStateContext();

  return (
    <aside className="flex min-h-0 flex-col border-l border-border bg-card">
      <div className="h-10 flex-shrink-0 border-b border-border px-3 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {state.rightPanelView === 'history' ? 'History' : 'Inspector'}
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        {state.rightPanelView === 'history' ? <HistoryInspector /> : <ContextInspector />}
      </div>
    </aside>
  );
}

function ContextInspector() {
  const { state, updateState } = useAppStateContext();
  const { blocks } = useIntakeBlocks();
  const selectedBlock = blocks.find((block) => block.id === state.selectedIntakeBlockId) ?? null;
  const selectedItem = state.reviewItems.find((item) => item.id === state.selectedItemId) ?? null;
  const reviewActions = useReviewActions();

  const handleHeaderChange = (key: HeaderKey, value: string) => {
    if (!selectedBlock) return;
    updateState((prev) => ({
      aiInput: updateDirectiveInText(prev.aiInput, selectedBlock, key, value, { keepEmpty: true }),
    }));
  };

  const handleDirectiveChange = (key: DirectiveKey, value: string) => {
    if (!selectedBlock) return;
    updateState((prev) => ({
      aiInput: updateDirectiveInText(prev.aiInput, selectedBlock, key, value),
    }));
  };

  const handleAddDirective = (key: DirectiveKey) => {
    if (!selectedBlock || selectedBlock.directives[key]) return;
    updateState((prev) => ({
      aiInput: updateDirectiveInText(prev.aiInput, selectedBlock, key, '', { allowEmptyInsert: true }),
    }));
  };

  if (state.mode === 'intake') {
    return (
      <div className="space-y-4">
        <HeaderDirectiveEditor
          block={selectedBlock}
          onHeaderChange={handleHeaderChange}
          onDirectiveChange={handleDirectiveChange}
          onAddDirective={handleAddDirective}
        />
        {state.parseErrors.length > 0 && (
          <InspectorSection title="Parse Errors">
            <ul className="space-y-1 text-xs text-destructive">
              {state.parseErrors.map((error, index) => (
                <li key={`${error}-${index}`}>{error}</li>
              ))}
            </ul>
          </InspectorSection>
        )}
      </div>
    );
  }

  if (!selectedItem) {
    return <p className="py-3 text-xs text-muted-foreground">Select a change to inspect.</p>;
  }

  return (
    <div className="space-y-4 py-3">
      <InspectorSection title="Selection">
        <dl className="space-y-2 text-xs">
          <InspectorRow label="File" value={selectedItem.file} mono />
          <InspectorRow label="Mode" value={selectedItem.mode} />
          <InspectorRow label="Status" value={selectedItem.status} />
          <InspectorRow label="Language" value={selectedItem.language} />
          <InspectorRow label="Lines" value={String(selectedItem.lineCount)} />
          {state.selectedHunkId && <InspectorRow label="Hunk" value={state.selectedHunkId} />}
        </dl>
        {selectedItem.validationError && (
          <p className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
            {selectedItem.validationError}
          </p>
        )}
      </InspectorSection>

      <ReviewDirectiveEditor item={selectedItem} onSave={(updates) => reviewActions.handleUpdateDirectives(selectedItem.id, updates)} />
    </div>
  );
}

function ReviewDirectiveEditor({
  item,
  onSave,
}: {
  item: NonNullable<ReturnType<typeof useReviewActions>['selectedItem']>;
  onSave: (updates: Partial<Record<HeaderKey | DirectiveKey, string>>) => void;
}) {
  const [draft, setDraft] = useState<Partial<Record<HeaderKey | DirectiveKey, string>>>({});

  useEffect(() => {
    const nextDraft: Partial<Record<HeaderKey | DirectiveKey, string>> = {
      FILE: item.file,
      MODE: item.mode,
    };
    DIRECTIVE_KEYS.forEach((key) => {
      if (item.directives[key]) nextDraft[key] = item.directives[key];
    });
    setDraft(nextDraft);
  }, [item]);

  const presentDirectiveKeys = DIRECTIVE_KEYS.filter((key) => Object.prototype.hasOwnProperty.call(draft, key));
  const missingDirectiveKeys = DIRECTIVE_KEYS.filter((key) => !Object.prototype.hasOwnProperty.call(draft, key));

  if (item.status === 'applied') {
    return (
      <InspectorSection title="Directives">
        <p className="text-xs text-muted-foreground">Applied changes cannot be edited.</p>
      </InspectorSection>
    );
  }

  return (
    <InspectorSection title="Headers & Directives">
      <div className="space-y-3">
        {HEADER_KEYS.map((key) => (
          <label key={key} className="block text-xs text-muted-foreground">
            <span className="text-[11px] font-semibold text-foreground">{key}</span>
            {key === 'MODE' ? (
              <Select
                className="mt-1 font-mono"
                value={draft.MODE ?? ''}
                placeholder="MODE:"
                options={VALID_MODES.map((mode) => ({ value: mode, label: mode }))}
                onChange={(event) => setDraft((prev) => ({ ...prev, MODE: event.target.value }))}
              />
            ) : (
              <input
                value={draft[key] ?? ''}
                onChange={(event) => setDraft((prev) => ({ ...prev, [key]: event.target.value }))}
                className="mt-1 w-full rounded-md border border-border bg-secondary/60 px-2.5 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder={`${key}:`}
              />
            )}
          </label>
        ))}
        {presentDirectiveKeys.map((key) => (
          <label key={key} className="block text-xs text-muted-foreground">
            <span className="text-[11px] font-semibold text-foreground">{key}</span>
            <input
              value={draft[key] ?? ''}
              onChange={(event) => setDraft((prev) => ({ ...prev, [key]: event.target.value }))}
              className="mt-1 w-full rounded-md border border-border bg-secondary/60 px-2.5 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder={`${key}:`}
            />
          </label>
        ))}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-foreground">Add</span>
          <Select
            className="flex-1"
            value=""
            placeholder="Directive"
            options={missingDirectiveKeys.map((key) => ({ value: key, label: key }))}
            onChange={(event) => {
              if (event.target.value) {
                const key = event.target.value as DirectiveKey;
                setDraft((prev) => ({ ...prev, [key]: prev[key] ?? '' }));
              }
            }}
          />
        </div>
        <Button size="sm" type="button" className="w-full" onClick={() => onSave(draft)}>
          Save Directives
        </Button>
      </div>
    </InspectorSection>
  );
}

function HistoryInspector() {
  const { state } = useAppStateContext();
  const { restoreItem, restoreGroup } = useHistoryActions();
  const activeItems = state.historyItems.filter((item) => !item.restoredAt);
  const groupedHistory = useMemo(() => {
    const groups = new Map<string, typeof activeItems>();
    activeItems.forEach((item) => {
      const group = groups.get(item.applyId) ?? [];
      group.push(item);
      groups.set(item.applyId, group);
    });
    return Array.from(groups.entries()).map(([applyId, items]) => ({
      applyId,
      items,
      createdAt: items[0]?.createdAt,
    }));
  }, [activeItems]);

  const formatTimestamp = (timestamp?: string) => {
    if (!timestamp) return 'Unknown time';
    const date = new Date(timestamp);
    if (Number.isNaN(date.valueOf())) return timestamp;
    return date.toLocaleString();
  };

  if (groupedHistory.length === 0) {
    return <p className="py-3 text-xs text-muted-foreground">No applied blocks to restore yet.</p>;
  }

  return (
    <div className="space-y-4 py-3">
      {groupedHistory.map((group) => (
        <div key={group.applyId} className="border-b border-border pb-4">
          <div className="mb-2 flex items-start justify-between gap-2">
            <div>
              <p className="text-xs text-muted-foreground">Applied {formatTimestamp(group.createdAt)}</p>
              <p className="text-sm font-semibold">{group.items.length} block{group.items.length === 1 ? '' : 's'}</p>
            </div>
            {group.items.length > 1 && (
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={() => restoreGroup(group.applyId)}
                disabled={state.isRestoringInProgress}
                className="gap-1"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Restore
              </Button>
            )}
          </div>
          <div className="space-y-1">
            {group.items.map((item) => {
              const restoreMeta = item.restoreMeta ?? {
                file: item.restoreOperation?.file ?? item.file,
                lineCount: item.restoreOperation?.content ? item.restoreOperation.content.split('\n').length : 0,
                language: getLanguageFromFilename(item.restoreOperation?.file ?? item.file),
                mode: item.restoreOperation?.type ?? item.mode ?? 'range',
              };
              return (
                <FileListEntry
                  key={item.id}
                  file={restoreMeta.file}
                  lineCount={restoreMeta.lineCount}
                  language={restoreMeta.language}
                  mode={restoreMeta.mode}
                  status="applied"
                  actions={
                    <Button
                      variant="ghost"
                      size="icon"
                      type="button"
                      className="h-6 w-6"
                      onClick={() => restoreItem(item)}
                      disabled={state.isRestoringInProgress}
                      aria-label={`Restore ${restoreMeta.file}`}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </Button>
                  }
                  actionPlacement="top"
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function InspectorSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

function InspectorRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn('truncate text-foreground', mono && 'font-mono')} title={value}>{value}</dd>
    </div>
  );
}

function ChromeButton({
  active,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex h-7 items-center justify-center gap-1 rounded-md px-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-45',
        active && 'bg-primary/10 text-foreground',
        className,
      )}
      {...props}
    />
  );
}
