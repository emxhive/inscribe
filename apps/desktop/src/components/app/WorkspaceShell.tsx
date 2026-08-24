import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ClipboardPaste,
  Copy,
  Folder,
  FileCode2,
  History,
  Keyboard,
  Loader2,
  PanelLeft,
  PanelRight,
  RotateCcw,
  Save,
  Settings,
  SquareTerminal,
  Trash2,
  Upload,
} from 'lucide-react';
import { DIRECTIVE_KEYS, HEADER_KEYS, OPERATION_MODES, type DirectiveKey, type HeaderKey } from '@inscribe/shared';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/common';
import { FileListEntry } from '@/components/common/FileListEntry';
import { useAppStateContext, useApplyActions, useHistoryActions, useIntakeBlocks, useParsingActions, usePrimaryAction, useRepositoryActions, useReviewActions } from '@/hooks';
import {
  getLanguageFromFilename,
  getPathBasename,
  getReviewApplySummary,
  getReviewItemApplyState,
  parseLiveIntakeStructure,
  removeIntakeBlockFromText,
  toSentenceCase,
} from '@/utils';
import { updateDirectiveInText } from '@/utils/intake';
import { FileSidebar, MAX_SIDEBAR_WIDTH, MIN_SIDEBAR_WIDTH } from './FileSidebar';
import { IntakePanel } from './IntakePanel';
import { ReviewPanel } from './ReviewPanel';
import { HeaderDirectiveEditor } from './HeaderDirectiveEditor';
import { KeyboardShortcutsModal } from '../KeyboardShortcutsModal';

import { TerminalPanel } from './TerminalPanel';
import { cn } from '@/lib/utils';
import { getNextRecentRepositoryIndex } from '@/utils/recentRepositories';
import type { AppState, V1ReviewItem, V2ReviewFile, V2ReviewItem } from '@/types';
import type { PrimaryAction } from '@/utils/primaryAction';
import { buildDiagnosticGroups, formatDiagnosticGroupForClipboard, type DiagnosticGroup } from '@/utils/diagnostics';
import { PanelTabs } from '@/components/ui/panel-tabs';
import {
  KEYBOARD_SHORTCUTS,
  getKeyboardShortcutDisplay,
  hasBlockingShortcutOverlay,
  isEditorKeyboardTarget,
  isInteractiveKeyboardTarget,
  isTextEditingKeyboardTarget,
  matchesKeyboardShortcut,
  shouldHandleKeyboardShortcut,
} from '@/utils/keyboardShortcuts';

const RIGHT_PANEL_WIDTH = 360;
const PANEL_STORAGE_KEYS = {
  leftCollapsed: 'inscribe:ui:leftCollapsed',
  rightCollapsed: 'inscribe:ui:rightCollapsed',
  leftWidth: 'inscribe:ui:leftPanelWidth',
} as const;

type WorkspaceShellProps = {
  onOpenIgnore: () => void;
  onOpenIndexedList: () => void;
};

type WorkspaceTopBarProps = WorkspaceShellProps & {
  onReplaceIntakeFromClipboard: () => void;
  onUploadIntake: () => void;
  onOpenRepository: () => void;
  onToggleHistory: () => void;
  showRecentRepositories: boolean;
  onShowRecentRepositoriesChange: (open: boolean) => void;
  onShowKeyboardShortcuts: () => void;
};

function isV1ReviewItem(item: AppState['reviewItems'][number]): item is V1ReviewItem {
  return item.engineVersion !== 'v2';
}

export function WorkspaceShell({
  onOpenIgnore,
  onOpenIndexedList,
}: WorkspaceShellProps) {
  const { state, updateState } = useAppStateContext();
  const repositoryActions = useRepositoryActions();
  const primaryAction = usePrimaryAction();
  const replaceIntakeFromClipboard = useReplaceIntakeFromClipboard();
  const uploadIntake = useUploadIntake();
  const [showRecentRepositories, setShowRecentRepositories] = useState(false);
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const toggleHistory = useCallback(() => {
    updateState((prev) => ({
      rightPanelOwner: 'history',
      isRightPanelCollapsed: prev.rightPanelOwner === 'history' && !prev.isRightPanelCollapsed,
    }));
  }, [updateState]);
  const panelPersistenceReady = useRef(false);
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    if (typeof window === 'undefined') return 280;
    const stored = window.localStorage.getItem(PANEL_STORAGE_KEYS.leftWidth);
    const parsed = stored ? Number(stored) : 280;
    if (!Number.isFinite(parsed)) return 280;
    return Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, parsed));
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const leftCollapsed = window.localStorage.getItem(PANEL_STORAGE_KEYS.leftCollapsed) === 'true';
    const rightCollapsed = window.localStorage.getItem(PANEL_STORAGE_KEYS.rightCollapsed) === 'true';
    updateState({
      isLeftPanelCollapsed: leftCollapsed,
      isRightPanelCollapsed: rightCollapsed,
    });
    panelPersistenceReady.current = true;
  }, [updateState]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!panelPersistenceReady.current) return;
    window.localStorage.setItem(PANEL_STORAGE_KEYS.leftCollapsed, String(state.isLeftPanelCollapsed));
    window.localStorage.setItem(PANEL_STORAGE_KEYS.rightCollapsed, String(state.isRightPanelCollapsed));
  }, [state.isLeftPanelCollapsed, state.isRightPanelCollapsed]);

  const [hasMountedTerminal, setHasMountedTerminal] = useState(false);

  useEffect(() => {
    if (state.isTerminalOpen && !hasMountedTerminal) {
      setHasMountedTerminal(true);
    }
  }, [state.isTerminalOpen, hasMountedTerminal]);

  useEffect(() => {
    if (!state.isTerminalOpen) {
      setHasMountedTerminal(false);
    }
  }, [state.repoRoot]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;

      if (event.key === 'Escape' && !hasBlockingShortcutOverlay() && isEditorKeyboardTarget(event.target)) {
        event.preventDefault();
        if (event.target instanceof HTMLElement) {
          event.target.blur();
        }
        workspaceRef.current?.focus({ preventScroll: true });
        return;
      }

      const shortcut = KEYBOARD_SHORTCUTS.find((candidate) => matchesKeyboardShortcut(event, candidate));
      if (!shortcut || !shouldHandleKeyboardShortcut(
        event,
        shortcut,
        isInteractiveKeyboardTarget(event.target),
        hasBlockingShortcutOverlay(),
        isTextEditingKeyboardTarget(event.target),
      )) return;

      event.preventDefault();
      switch (shortcut.id) {
        case 'paste-intake':
          void replaceIntakeFromClipboard();
          break;
        case 'open-repository':
          void repositoryActions.handleBrowseRepo();
          break;
        case 'open-recent-repositories':
          setShowRecentRepositories(true);
          break;
        case 'open-history':
          toggleHistory();
          break;
        case 'open-intake-file':
          void uploadIntake();
          break;
        case 'toggle-terminal':
          updateState((prev) => ({ isTerminalOpen: !prev.isTerminalOpen }));
          break;
        case 'show-keyboard-shortcuts':
          setShowKeyboardShortcuts(true);
          break;
        case 'primary-action':
          primaryAction.run();
          break;
      }
    };

    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [primaryAction.run, replaceIntakeFromClipboard, repositoryActions.handleBrowseRepo, toggleHistory, updateState, uploadIntake]);

  const handleSidebarResize = (width: number, options?: { persist?: boolean }) => {
    const clamped = Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, width));
    setSidebarWidth(clamped);
    if (options?.persist && typeof window !== 'undefined') {
      window.localStorage.setItem(PANEL_STORAGE_KEYS.leftWidth, String(clamped));
    }
  };

  const workspaceColumns = [
    !state.isLeftPanelCollapsed ? `${sidebarWidth}px` : null,
    'minmax(0,1fr)',
    !state.isRightPanelCollapsed ? `${RIGHT_PANEL_WIDTH}px` : null,
  ].filter(Boolean).join(' ');

  return (
    <div ref={workspaceRef} tabIndex={-1} className="flex h-screen flex-col overflow-hidden bg-background outline-none">
      <WorkspaceTopBar
        onOpenIgnore={onOpenIgnore}
        onOpenIndexedList={onOpenIndexedList}
        onReplaceIntakeFromClipboard={replaceIntakeFromClipboard}
        onUploadIntake={uploadIntake}
        onOpenRepository={repositoryActions.handleBrowseRepo}
        onToggleHistory={toggleHistory}
        showRecentRepositories={showRecentRepositories}
        onShowRecentRepositoriesChange={setShowRecentRepositories}
        onShowKeyboardShortcuts={() => setShowKeyboardShortcuts(true)}
      />
      <div
        className="grid min-h-0 flex-1 overflow-hidden"
        style={{ gridTemplateColumns: workspaceColumns }}
      >
        {!state.isLeftPanelCollapsed && (
          <FileSidebar
            sidebarWidth={sidebarWidth}
            onResize={handleSidebarResize}
          />
        )}
        <main className="min-h-0 overflow-hidden">
          {state.isRestoringRepo && (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Restoring last repository...
            </div>
          )}
          {!state.isRestoringRepo && state.mode === 'intake' && <IntakePanel />}
          {!state.isRestoringRepo && state.mode === 'review' && <ReviewPanel />}
        </main>
        {!state.isRightPanelCollapsed && <RightPanel />}
      </div>
      {Boolean(state.repoRoot) && (state.isTerminalOpen || hasMountedTerminal) && (
        <div className={cn(state.isTerminalOpen ? 'block' : 'hidden')}>
          <TerminalPanel
            repoRoot={state.repoRoot}
            suggestions={state.terminalCommandSuggestions}
            isOpen={state.isTerminalOpen}
            onClose={() => updateState({ isTerminalOpen: false })}
          />
        </div>
      )}
      <WorkspaceBottomBar primaryAction={primaryAction.action} onRunPrimaryAction={primaryAction.run} />
      <KeyboardShortcutsModal
        isOpen={showKeyboardShortcuts}
        onClose={() => setShowKeyboardShortcuts(false)}
      />
    </div>
  );
}

function useReplaceIntakeFromClipboard() {
  const { updateState } = useAppStateContext();

  return useCallback(async () => {
    try {
      const clipboardText = await window.inscribeAPI.readClipboardText();
      if (!clipboardText.trim()) {
        updateState({
          mode: 'intake',
          statusMessage: 'Clipboard is empty.',
        });
        return;
      }

      replaceIntake(updateState, clipboardText, `Replaced intake with ${clipboardText.length} clipboard character${clipboardText.length === 1 ? '' : 's'}.`);
    } catch (error) {
      updateState({
        mode: 'intake',
        statusMessage: `Unable to read clipboard: ${error}`,
      });
    }
  }, [updateState]);
}

function replaceIntake(
  updateState: ReturnType<typeof useAppStateContext>['updateState'],
  content: string,
  statusMessage: string,
) {
  updateState({
    mode: 'intake',
    aiInput: content,
    parseErrors: [],
    parseWarnings: [],
    v2PreviewDiagnostics: [],
    parsedBlocks: [],
    validationErrors: [],
    reviewItems: [],
    v2ReviewFiles: [],
    selectedItemId: null,
    selectedV2FileId: null,
    selectedIntakeBlockId: null,
    selectedIntakeLineIndex: null,
    rightPanelOwner: 'inspector',
    rightPanelView: 'properties',
    isEditing: false,
    pipelineStatus: 'idle',
    reviewComparisonError: null,
    reviewPreflightByItem: {},
    reviewComparisonByItem: {},
    collapsedHunkIdsByItem: {},
    collapsedHunkIdsByFile: {},
    collapsedDiffGroupIdsByItem: {},
    collapsedDiffGroupIdsByFile: {},
    terminalCommandSuggestions: [],
    terminalSuggestionSourceApplyId: null,
    lastAppliedPlan: null,
    canRedo: false,
    lastApplyId: null,
    canUndoApply: false,
    v2PreviewSession: null,
    statusMessage,
  });
}

function useUploadIntake() {
  const { updateState } = useAppStateContext();

  return useCallback(async () => {
    try {
      const selectedFile = await window.inscribeAPI.selectMarkdownFile();
      if (!selectedFile) return;

      if (!selectedFile.content.trim()) {
        updateState({ mode: 'intake', statusMessage: 'Selected Markdown document is empty.' });
        return;
      }

      replaceIntake(updateState, selectedFile.content, `Loaded ${getPathBasename(selectedFile.path)} into intake.`);
    } catch (error) {
      updateState({
        mode: 'intake',
        statusMessage: `Unable to upload Markdown document: ${error}`,
      });
    }
  }, [updateState]);
}

function WorkspaceTopBar({
  onOpenIgnore,
  onOpenIndexedList,
  onReplaceIntakeFromClipboard,
  onUploadIntake,
  onOpenRepository,
  onToggleHistory,
  showRecentRepositories,
  onShowRecentRepositoriesChange,
  onShowKeyboardShortcuts,
}: WorkspaceTopBarProps) {
  const { state, updateState } = useAppStateContext();
  const hasRepository = Boolean(state.repoRoot);
  const [recentProjects, setRecentProjects] = useState<string[]>([]);
  const [selectedRecentProject, setSelectedRecentProject] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const recentTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    window.inscribeAPI.getRecentProjects().then(setRecentProjects);
    return window.inscribeAPI.onRecentProjectsUpdated(setRecentProjects);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onShowRecentRepositoriesChange(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onShowRecentRepositoriesChange]);

  useEffect(() => {
    if (!showRecentRepositories) return;
    dropdownRef.current?.querySelector<HTMLButtonElement>('[data-recent-item="true"]')?.focus();
  }, [recentProjects, showRecentRepositories]);

  const handleRecentKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const recentItems = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>('[data-recent-item="true"]'),
    );
    if (event.key === 'Escape') {
      event.preventDefault();
      onShowRecentRepositoriesChange(false);
      recentTriggerRef.current?.focus();
      return;
    }
    if (recentItems.length === 0) return;

    const currentIndex = recentItems.indexOf(document.activeElement as HTMLButtonElement);
    let nextIndex: number | null = null;
    if (event.key === 'ArrowDown') {
      nextIndex = getNextRecentRepositoryIndex(currentIndex, recentItems.length, 'next');
    } else if (event.key === 'ArrowUp') {
      nextIndex = getNextRecentRepositoryIndex(currentIndex, recentItems.length, 'previous');
    } else if (event.key === 'Home') {
      nextIndex = getNextRecentRepositoryIndex(currentIndex, recentItems.length, 'first');
    } else if (event.key === 'End') {
      nextIndex = getNextRecentRepositoryIndex(currentIndex, recentItems.length, 'last');
    }

    if (nextIndex !== null) {
      event.preventDefault();
      recentItems[nextIndex]?.focus();
    }
  };

  const requireRepository = (action: () => void, message: string) => {
    if (!hasRepository) {
      updateState({ statusMessage: message });
      return;
    }
    action();
  };

  const handleRecentClick = (path: string) => {
    setSelectedRecentProject(path);
    onShowRecentRepositoriesChange(false);
  };

  const handleOpenRecentProject = (target: 'same-window' | 'new-window') => {
    if (!selectedRecentProject) return;
    window.inscribeAPI.openRepository(selectedRecentProject, target);
    setSelectedRecentProject(null);
  };

  return (
    <header className="relative z-50 flex h-11 flex-shrink-0 items-center gap-2 border-b border-border bg-card px-3">
      <ChromeButton
        onClick={() => updateState({ isLeftPanelCollapsed: !state.isLeftPanelCollapsed })}
        title={state.isLeftPanelCollapsed ? 'Show left panel' : 'Hide left panel'}
        aria-label={state.isLeftPanelCollapsed ? 'Show left panel' : 'Hide left panel'}
        active={!state.isLeftPanelCollapsed}
      >
        <PanelLeft className="h-3.5 w-3.5" />
      </ChromeButton>
      <div className="flex min-w-0 items-center gap-2">
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
              ref={recentTriggerRef}
              className="absolute right-1.5 rounded-sm p-1 hover:bg-accent hover:text-accent-foreground"
              onClick={() => onShowRecentRepositoriesChange(!showRecentRepositories)}
              title={`Recent projects (${getKeyboardShortcutDisplay('open-recent-repositories')})`}
              type="button"
            >
              <Clock className="h-3.5 w-3.5" />
            </button>
          )}
          {showRecentRepositories && (
            <div
              ref={dropdownRef}
              onKeyDown={handleRecentKeyDown}
              data-inscribe-shortcut-overlay="true"
              className="absolute left-0 top-full z-[100] mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-border bg-popover py-1 shadow-lg"
            >
              <div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Recent Projects
              </div>
              {recentProjects.length > 0 ? recentProjects.map((path) => (
                <button
                  key={path}
                  data-recent-item="true"
                  className="w-full truncate px-3 py-2 text-left text-xs hover:bg-accent hover:text-accent-foreground"
                  onClick={() => handleRecentClick(path)}
                  title={path}
                  type="button"
                >
                  <div className="truncate font-medium">{getPathBasename(path)}</div>
                  <div className="truncate text-[10px] text-muted-foreground">{path}</div>
                </button>
              )) : (
                <div className="px-3 py-3 text-xs text-muted-foreground">
                  <p>No recent repositories yet.</p>
                  <Button
                    data-recent-item="true"
                    variant="outline"
                    size="sm"
                    className="mt-2 h-7"
                    type="button"
                    onClick={() => {
                      onShowRecentRepositoriesChange(false);
                      onOpenRepository();
                    }}
                  >
                    Open Repository
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
        <Button
          variant="outline"
          size="icon"
          type="button"
          className="h-7 w-7"
          title={`Open repository (${getKeyboardShortcutDisplay('open-repository')})`}
          aria-label="Browse for repository"
          onClick={onOpenRepository}
        >
          <Folder className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="ml-auto flex items-center gap-1">
        <ChromeButton active={state.mode === 'intake'} onClick={() => updateState({ mode: 'intake' })}>
          Intake
        </ChromeButton>
        <ChromeButton
          onClick={onReplaceIntakeFromClipboard}
          title={`Paste intake from clipboard (${getKeyboardShortcutDisplay('paste-intake')})`}
          aria-label="Replace intake from clipboard"
        >
          <ClipboardPaste className="h-3.5 w-3.5" />
        </ChromeButton>
        <ChromeButton
          onClick={onUploadIntake}
          title={`Open intake file (${getKeyboardShortcutDisplay('open-intake-file')})`}
          aria-label="Upload Markdown document"
        >
          <Upload className="h-3.5 w-3.5" />
        </ChromeButton>
        <ChromeButton
          active={state.mode === 'review'}
          onClick={() => updateState({ mode: 'review' })}
          disabled={state.reviewItems.length === 0}
        >
          Review
        </ChromeButton>
        <span className="mx-1 h-4 w-px bg-border" />
        <ChromeButton disabled={!hasRepository} onClick={() => requireRepository(onOpenIgnore, 'Select a repository to edit ignore rules.')}>
          Ignore {state.ignore.entries.length}
        </ChromeButton>
        <ChromeButton onClick={onOpenIndexedList}>Indexed {state.indexedCount}</ChromeButton>
        <ChromeButton
          active={state.rightPanelOwner === 'history' && !state.isRightPanelCollapsed}
          onClick={onToggleHistory}
          title={`History (${getKeyboardShortcutDisplay('open-history')})`}
        >
          <History className="h-3.5 w-3.5" />
        </ChromeButton>
        <ChromeButton onClick={() => updateState({ statusMessage: 'Settings (placeholder)' })} title="Settings">
          <Settings className="h-3.5 w-3.5" />
        </ChromeButton>
        <ChromeButton
          onClick={onShowKeyboardShortcuts}
          title={`Keyboard shortcuts (${getKeyboardShortcutDisplay('show-keyboard-shortcuts')})`}
          aria-label="Keyboard shortcuts"
        >
          <Keyboard className="h-3.5 w-3.5" />
        </ChromeButton>
        <ChromeButton
          onClick={() => updateState({ isTerminalOpen: !state.isTerminalOpen })}
          title={`${state.isTerminalOpen ? 'Hide terminal' : 'Show terminal'} (${getKeyboardShortcutDisplay('toggle-terminal')})`}
          aria-label={state.isTerminalOpen ? 'Hide terminal' : 'Show terminal'}
          active={state.isTerminalOpen}
        >
          <SquareTerminal className="h-3.5 w-3.5" />
        </ChromeButton>
        <ChromeButton
          onClick={() => updateState({ isRightPanelCollapsed: !state.isRightPanelCollapsed })}
          title={state.isRightPanelCollapsed ? 'Show right panel' : 'Hide right panel'}
          aria-label={state.isRightPanelCollapsed ? 'Show right panel' : 'Hide right panel'}
          active={!state.isRightPanelCollapsed}
        >
          <PanelRight className="h-3.5 w-3.5" />
        </ChromeButton>
      </div>
      <Modal
        isOpen={Boolean(selectedRecentProject)}
        onClose={() => setSelectedRecentProject(null)}
        title="Open Project"
        footer={
          <>
            <Button
              variant="outline"
              type="button"
              onClick={() => setSelectedRecentProject(null)}
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              type="button"
              onClick={() => handleOpenRecentProject('same-window')}
            >
              Open in This Window
            </Button>
            <Button
              type="button"
              onClick={() => handleOpenRecentProject('new-window')}
            >
              Open in New Window
            </Button>
          </>
        }
      >
        <div className="space-y-2 text-sm">
          <p className="text-foreground">How do you want to open this project?</p>
          <p className="break-all rounded-md border border-border bg-secondary/60 px-3 py-2 font-mono text-xs text-muted-foreground">
            {selectedRecentProject}
          </p>
        </div>
      </Modal>
    </header>
  );
}

function WorkspaceBottomBar({
  primaryAction,
  onRunPrimaryAction,
}: {
  primaryAction: PrimaryAction;
  onRunPrimaryAction: () => void;
}) {
  const { state, updateState } = useAppStateContext();
  const { handleParseBlocks } = useParsingActions();
  const applyActions = useApplyActions();
  const selectedItem = state.reviewItems.find(
    (item): item is V1ReviewItem => item.id === state.selectedItemId && isV1ReviewItem(item),
  ) ?? null;
  const hasV2Review = state.v2ReviewFiles.length > 0;
  const applySummary = getReviewApplySummary(state.reviewItems, state.reviewPreflightByItem);
  const selectedIsApplied = selectedItem?.status === 'applied';
  const selectedApplyState = selectedItem ? getReviewItemApplyState(selectedItem, state.reviewPreflightByItem) : null;
  const canApplySelected = Boolean(selectedApplyState?.applyable) && !state.isApplyingInProgress;
  const canUndoSelected =
    Boolean(selectedItem) &&
    selectedIsApplied &&
    state.historyItems.some(
      (item) => item.file === selectedItem.file && item.blockIndex === selectedItem.blockIndex && !item.restoredAt,
    );

  const hasPartialV2Preview =
    primaryAction.id === 'review-v2-partial';
  const canReturnToPartialIntake =
    state.mode === 'review' &&
    Boolean(state.v2PreviewSession) &&
    state.v2PreviewDiagnostics.length > 0 &&
    state.reviewItems.length > 0 &&
    state.reviewItems.every((item) => item.engineVersion === 'v2' && item.status === 'pending');

  const selectedHunkIndex = state.selectedHunkId
    ? 0
    : -1;

  const statusIcon = (() => {
    switch (state.pipelineStatus) {
      case 'parsing':
      case 'applying':
        return <Loader2 className="h-3.5 w-3.5 animate-spin" />;
      case 'parse-success':
      case 'apply-success':
        return <CheckCircle2 className="h-3.5 w-3.5" />;
      case 'parse-partial':
        return <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />;
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
        <>
          {hasPartialV2Preview && (
            <Button
              variant="default"
              type="button"
              size="sm"
              onClick={onRunPrimaryAction}
              disabled={!primaryAction.enabled}
            >
              <PrimaryActionButtonLabel label={primaryAction.label} />
            </Button>
          )}
          <Button
            variant={primaryAction.id === 'parse' ? 'default' : 'outline'}
            type="button"
            size="sm"
            onClick={primaryAction.id === 'parse' ? onRunPrimaryAction : handleParseBlocks}
            disabled={primaryAction.id === 'parse' ? !primaryAction.enabled : !state.repoRoot || state.isParsingInProgress}
            title={primaryAction.id === 'parse' && !state.repoRoot ? 'Select a repository first' : primaryAction.id === 'parse' && state.isParsingInProgress ? 'Parsing in progress...' : ''}
          >
            {primaryAction.id === 'parse'
              ? <PrimaryActionButtonLabel label={primaryAction.label} />
              : 'Parse Code Blocks'}
          </Button>
        </>
      )}

      {state.mode === 'review' && (
        <>
          {canReturnToPartialIntake && (
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => updateState({
                mode: 'intake',
                pipelineStatus: 'parse-partial',
                statusMessage: 'Partial V2 preview preserved. Select Review valid blocks to return.',
              })}
            >
              Back to Intake
            </Button>
          )}
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
          {!hasV2Review && (
            <>
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
                disabled={!applySummary.canApplyValid || state.isApplyingInProgress}
              >
                Apply Valid
              </Button>
            </>
          )}
          <Button
            type="button"
            size="sm"
            onClick={onRunPrimaryAction}
            disabled={!primaryAction.enabled}
          >
            <PrimaryActionButtonLabel label={primaryAction.label} />
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

function PrimaryActionButtonLabel({ label }: { label: string }) {
  return (
    <span className="flex min-w-0 items-baseline gap-1">
      <span className="truncate">{label}</span>
      <kbd className="shrink-0 rounded border border-primary-foreground/20 bg-primary-foreground/10 px-1.5 py-0.5 font-mono text-[9px] font-medium leading-none tracking-tight text-primary-foreground/70">
        {getKeyboardShortcutDisplay('primary-action')}
      </kbd>
    </span>
  );
}

function RightPanel() {
  const { state } = useAppStateContext();
  return state.rightPanelOwner === 'history' ? <HistoryRightPanel /> : <InspectorRightPanel />;
}

function HistoryRightPanel() {
  const { updateState } = useAppStateContext();
  return (
    <aside className="flex min-h-0 flex-col border-l border-border bg-card">
      <div className="flex h-10 flex-shrink-0 items-center justify-between border-b border-border px-3">
        <p className="text-xs font-semibold text-foreground">History</p>
        <button
          type="button"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          onClick={() => updateState({ rightPanelOwner: 'inspector' })}
          aria-label="Show inspector"
          title="Show inspector"
        >
          <FileCode2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3">
        <HistoryPanelContent />
      </div>
    </aside>
  );
}

function InspectorRightPanel() {
  const { state, updateState } = useAppStateContext();
  const { blocks, warnings: globalWarnings } = useIntakeBlocks();
  const selectedBlock = blocks.find((block) => block.id === state.selectedIntakeBlockId) ?? null;
  const selectedItem = state.reviewItems.find(
    (item): item is V1ReviewItem => item.id === state.selectedItemId && isV1ReviewItem(item),
  ) ?? null;
  const selectedV2File = state.v2ReviewFiles.find((file) => file.id === state.selectedV2FileId) ?? null;
  const selectedV2Operations: V2ReviewItem[] = selectedV2File
    ? state.reviewItems.filter(
        (item): item is V2ReviewItem =>
          item.engineVersion === 'v2' && selectedV2File.operationIds.includes(item.id),
      )
    : [];
  const [blockPendingRemoval, setBlockPendingRemoval] = useState<typeof selectedBlock>(null);
  const reviewActions = useReviewActions();
  const diagnostics = buildDiagnosticGroups(state, blocks, { mode: state.mode, globalWarnings });
  const diagnosticCount = diagnostics.reduce((sum, group) => sum + group.messages.length, 0);
  const selectionLabel = state.mode === 'intake'
    ? selectedBlock?.label ?? 'No block selected'
    : selectedV2File?.filePath ?? selectedItem?.file ?? 'No change selected';
  const selectionStatus = state.mode === 'intake'
    ? selectedBlock?.status
    : selectedV2File
      ? selectedV2Operations.every((item) => item.status === 'applied') ? 'applied' : 'pending'
      : selectedItem?.status;
  const selectionMeta = state.mode === 'intake'
    ? selectedBlock
      ? `${toSentenceCase(selectedBlock.status)} · Block ${selectedBlock.index + 1}`
      : 'Select a block from the sidebar'
    : selectedV2File
      ? `${toSentenceCase(selectedV2Operations.every((item) => item.status === 'applied') ? 'applied' : 'pending')} · ${selectedV2Operations.length} operation${selectedV2Operations.length === 1 ? '' : 's'}`
      : selectedItem
        ? `${toSentenceCase(selectedItem.status)} · Change ${state.reviewItems.findIndex((item) => item.id === selectedItem.id) + 1}`
        : 'Select a change from the sidebar';
  const tabs = [
    { id: 'properties' as const, label: 'Properties' },
    { id: 'diagnostics' as const, label: 'Diagnostics', count: diagnosticCount },
  ];

  const handleNavigateDiagnostic = (target: { blockId: string; line?: number }) => {
    updateState({
      mode: 'intake',
      selectedIntakeBlockId: target.blockId,
      selectedIntakeLineIndex: typeof target.line === 'number' ? Math.max(0, target.line - 1) : null,
      statusMessage: target.line
        ? `Selected diagnostic at line ${target.line}.`
        : 'Selected block diagnostic.',
    });
  };

  const handleConfirmRemoveBlock = () => {
    if (!blockPendingRemoval) {
      return;
    }

    const removedIndex = blocks.findIndex((block) => block.id === blockPendingRemoval.id);
    const nextInput = removeIntakeBlockFromText(state.aiInput, blockPendingRemoval);
    const nextStructure = parseLiveIntakeStructure(nextInput, { indexedFileSet: state.indexedFileSet });
    const nextSelection = nextStructure.blocks.length > 0
      ? nextStructure.blocks[Math.min(Math.max(removedIndex, 0), nextStructure.blocks.length - 1)].id
      : null;

    updateState({
      aiInput: nextInput,
      mode: 'intake',
      parseErrors: [],
      parseWarnings: [],
      v2PreviewDiagnostics: [],
      parsedBlocks: [],
      validationErrors: [],
      reviewItems: [],
      v2ReviewFiles: [],
      selectedItemId: null,
      selectedV2FileId: null,
      selectedIntakeBlockId: nextSelection,
      selectedIntakeLineIndex: null,
      rightPanelOwner: 'inspector',
      rightPanelView: 'properties',
      selectedHunkId: null,
      reviewComparisonError: null,
      reviewPreflightByItem: {},
      reviewComparisonByItem: {},
      collapsedHunkIdsByItem: {},
      collapsedHunkIdsByFile: {},
      collapsedDiffGroupIdsByItem: {},
      collapsedDiffGroupIdsByFile: {},
      v2PreviewSession: null,
      pipelineStatus: 'idle',
      statusMessage: `Removed ${blockPendingRemoval.label}. Preview the remaining blocks again.`,
    });
    setBlockPendingRemoval(null);
  };

  const removalIssueCount = blockPendingRemoval
    ? new Set([...blockPendingRemoval.errors, ...blockPendingRemoval.warnings]).size
    : 0;

  return (
    <>
      <aside className="flex min-h-0 flex-col border-l border-border bg-card">
        <div className="flex h-10 flex-shrink-0 items-center justify-between border-b border-border px-3">
          <p className="text-xs font-semibold text-foreground">Inspector</p>
          <span className="text-[10px] capitalize text-muted-foreground">{state.mode}</span>
        </div>

        <div className="flex-shrink-0 border-b border-border px-3 py-2.5">
          <div className="flex items-center gap-2">
            <FileCode2 className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
            <p className="min-w-0 flex-1 truncate text-xs font-medium text-foreground" title={selectionLabel}>
              {selectionLabel}
            </p>
            {state.mode === 'intake' && selectedBlock?.protocol === 'v2' && (
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
                  selectionStatus === 'error' || selectionStatus === 'invalid'
                    ? 'bg-destructive'
                    : selectionStatus === 'warning' || selectionStatus === 'incomplete'
                      ? 'bg-amber-500'
                      : selectionStatus === 'applied'
                        ? 'bg-primary'
                        : 'bg-emerald-500',
                )}
              />
            )}
            <span className="truncate" title={selectionMeta}>{selectionMeta}</span>
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
                selectedBlock ? <IntakeDirectiveSection selectedBlock={selectedBlock} /> : <InspectorEmptyState message="Select a block to inspect its properties." />
              ) : selectedV2File ? (
                <ReviewFileProperties file={selectedV2File} operations={selectedV2Operations} />
              ) : selectedItem ? (
                <div className="space-y-4">
                  <ReviewProperties selectedItem={selectedItem} />
                  <ReviewDirectiveEditor
                    item={selectedItem}
                    onSave={(updates) => reviewActions.handleUpdateDirectives(selectedItem.id, updates)}
                  />
                </div>
              ) : (
                <InspectorEmptyState message="Select a change to inspect its properties." />
              )}
            </div>
          )}
          {state.rightPanelView === 'diagnostics' && (
            <div className="px-3 py-3">
              <DiagnosticsSection groups={diagnostics} onNavigate={handleNavigateDiagnostic} />
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
            <Button variant="outline" type="button" onClick={() => setBlockPendingRemoval(null)}>
              Cancel
            </Button>
            <Button variant="destructive" type="button" onClick={handleConfirmRemoveBlock}>
              <Trash2 className="h-4 w-4" />
              Remove block
            </Button>
          </>
        }
      >
        {blockPendingRemoval && (
          <div className="space-y-3 text-sm">
            <p className="text-foreground">
              This removes the complete V2 block from the intake text. The remaining blocks will need to be previewed again.
            </p>
            <div className="rounded-md border border-border bg-secondary/50 p-3">
              <p className="break-all text-xs font-medium text-foreground">{blockPendingRemoval.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {blockPendingRemoval.mode || 'Unknown mode'} · Lines {blockPendingRemoval.startLine + 1}–{blockPendingRemoval.endLine + 1}
                {removalIssueCount > 0 ? ` · ${removalIssueCount} issue${removalIssueCount === 1 ? '' : 's'}` : ''}
              </p>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

function V2IntakeInspector({ selectedBlock }: { selectedBlock: NonNullable<ReturnType<typeof useIntakeBlocks>['blocks'][number]> }) {
  const sectionsList = selectedBlock.sections ? Object.keys(selectedBlock.sections).join(', ') : '';

  return (
    <InspectorPropertyGroup title="Block">
      <dl className="divide-y divide-border text-xs">
        <InspectorRow label="Protocol" value="V2" />
        <InspectorRow label="Mode" value={selectedBlock.mode || '(none)'} />
        {selectedBlock.selectorText && (
          <InspectorRow label="Selector" value={selectedBlock.selectorText} mono />
        )}
        {sectionsList && (
          <InspectorRow label="Sections" value={sectionsList} />
        )}
        <InspectorRow label="Lines" value={`${selectedBlock.startLine + 1}–${selectedBlock.endLine + 1}`} />
      </dl>
    </InspectorPropertyGroup>
  );
}

function IntakeDirectiveSection({ selectedBlock }: { selectedBlock: ReturnType<typeof useIntakeBlocks>['blocks'][number] | null }) {
  const { state, updateState } = useAppStateContext();

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

  if (!selectedBlock) return null;

  if (selectedBlock.protocol === 'v2') {
    return <V2IntakeInspector selectedBlock={selectedBlock} />;
  }

  return (
    <HeaderDirectiveEditor
      block={selectedBlock}
      onHeaderChange={handleHeaderChange}
      onDirectiveChange={handleDirectiveChange}
      onAddDirective={handleAddDirective}
    />
  );
}

function ReviewFileProperties({
  file,
  operations,
}: {
  file: V2ReviewFile;
  operations: V2ReviewItem[];
}) {
  const diffHunks = file.comparison.diffHunks ?? [];
  const countChangedLines = (text: string) => {
    if (!text) return 0;
    const withoutTrailingNewline = text.endsWith('\n') ? text.slice(0, -1) : text;
    return withoutTrailingNewline.length === 0 ? 1 : withoutTrailingNewline.split('\n').length;
  };
  const stateLabel = !file.beforeExists && file.afterExists
    ? 'Created'
    : file.beforeExists && !file.afterExists
      ? 'Deleted'
      : 'Modified';
  const statusLabel = operations.length > 0 && operations.every((operation) => operation.status === 'applied')
    ? 'Applied'
    : 'Ready to apply';

  return (
    <div className="space-y-5">
      <InspectorPropertyGroup title="Final change">
        <dl className="divide-y divide-border text-xs">
          <InspectorRow label="File" value={file.filePath} mono />
          <InspectorRow label="State" value={stateLabel} />
          <InspectorRow label="Status" value={statusLabel} />
          <div className="grid min-h-8 grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-2 py-1.5">
            <dt className="text-muted-foreground">Change</dt>
            <dd className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-400">+{diffHunks.reduce((sum, hunk) => sum + countChangedLines(hunk.newText), 0)}</span>
              <span className="font-mono font-semibold text-destructive">−{diffHunks.reduce((sum, hunk) => sum + countChangedLines(hunk.oldText), 0)}</span>
              <span className="text-muted-foreground">{diffHunks.length} hunk{diffHunks.length === 1 ? '' : 's'}</span>
            </dd>
          </div>
          <InspectorRow label="Operations" value={String(operations.length)} />
        </dl>
      </InspectorPropertyGroup>

      <InspectorPropertyGroup title="Provenance">
        <div className="space-y-2 text-xs">
          {operations.map((operation) => {
            const target = operation.targetScope.selectorText
              ?? (operation.targetScope.lineRange
                ? `Lines ${operation.targetScope.lineRange.startLine}–${operation.targetScope.lineRange.endLine}`
                : operation.strategy === 'replace_file' || operation.strategy === 'create_file' || operation.strategy === 'delete_file'
                  ? 'Whole file'
                  : 'Target resolved');
            const fallback = operation.targetScope.matchMetadata?.kind === 'fallback';
            return (
              <div key={operation.id} className="rounded-md border border-border px-2.5 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-foreground">Operation {operation.operationIndex + 1} · Block {operation.blockIndex + 1}</span>
                  <span className="text-muted-foreground">{operation.strategy}</span>
                </div>
                <div className="mt-1 truncate font-mono text-[10px] text-muted-foreground" title={target}>{target}</div>
                {fallback && <div className="mt-1 text-[10px] text-amber-600 dark:text-amber-400">Fallback targeting used</div>}
              </div>
            );
          })}
        </div>
      </InspectorPropertyGroup>

      {operations.some((operation) => operation.targetScope.matchMetadata?.kind === 'fallback') && (
        <InspectorPropertyGroup title="Match / targeting">
          <dl className="divide-y divide-border text-xs">
            {operations
              .filter((operation) => operation.targetScope.matchMetadata?.kind === 'fallback')
              .map((operation) => {
                const metadata = operation.targetScope.matchMetadata!;
                return (
                  <div key={operation.id} className="py-1.5">
                    <div className="mb-1 text-muted-foreground">Operation {operation.operationIndex + 1}</div>
                    {typeof metadata.score === 'number' && <InspectorRow label="Score" value={`${Math.round(metadata.score * 100)}%`} />}
                    {metadata.fallbackReason && <InspectorRow label="Reason" value={toSentenceCase(metadata.fallbackReason)} />}
                    {metadata.unmatchedSoftTokens && metadata.unmatchedSoftTokens.length > 0 && (
                      <InspectorRow label="Unmatched" value={metadata.unmatchedSoftTokens.join(', ')} mono />
                    )}
                  </div>
                );
              })}
          </dl>
        </InspectorPropertyGroup>
      )}
    </div>
  );
}

function ReviewProperties({ selectedItem }: { selectedItem: V1ReviewItem }) {
  const { state } = useAppStateContext();
  const itemState = getReviewItemApplyState(selectedItem, state.reviewPreflightByItem);
  const comparison = state.reviewComparisonByItem[selectedItem.id]?.comparison;
  const diffHunks = comparison?.diffHunks ?? [];
  const countChangedLines = (text: string) => {
    if (!text) return 0;
    const withoutTrailingNewline = text.endsWith('\n') ? text.slice(0, -1) : text;
    return withoutTrailingNewline.length === 0 ? 1 : withoutTrailingNewline.split('\n').length;
  };
  const addedCount = diffHunks.reduce((sum, hunk) => sum + countChangedLines(hunk.newText), 0);
  const removedCount = diffHunks.reduce((sum, hunk) => sum + countChangedLines(hunk.oldText), 0);
  const status =
    itemState.kind === 'pending-applyable'
      ? 'Ready to apply'
      : itemState.kind === 'blocked-static-validation'
        ? 'Blocked by validation'
        : itemState.kind === 'blocked-preflight'
          ? 'Blocked by preflight'
          : itemState.kind === 'pending-preflight'
            ? 'Awaiting preflight'
            : itemState.kind === 'blocked-v2-apply'
              ? 'Preview only'
              : 'Applied';

  const mode = selectedItem.mode;

  return (
    <div className="space-y-5">
      <InspectorPropertyGroup title="Change">
        <dl className="divide-y divide-border text-xs">
          <InspectorRow label="Status" value={status} />
          <InspectorRow label="File" value={selectedItem.file} mono />
          <InspectorRow label="Mode" value={mode} />
          <div className="grid min-h-8 grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-2 py-1.5">
            <dt className="text-muted-foreground">Change</dt>
            <dd className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                +{addedCount}
              </span>
              <span className="font-mono font-semibold text-destructive">
                −{removedCount}
              </span>
              <span className="text-muted-foreground">
                {diffHunks.length} hunk{diffHunks.length === 1 ? '' : 's'}
              </span>
            </dd>
          </div>
          <InspectorRow label="Source block" value={String(selectedItem.blockIndex + 1)} />
          {state.selectedHunkId && <InspectorRow label="Hunk" value={state.selectedHunkId} mono />}
        </dl>
      </InspectorPropertyGroup>

    </div>
  );
}

function ReviewDirectiveEditor({
  item,
  onSave,
}: {
  item: V1ReviewItem;
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
      <div>
        <p className="text-xs text-muted-foreground">
          Applied changes cannot be edited.
        </p>
      </div>
    );
  }

  return (
    <InspectorPropertyGroup title="Editable">
      <div className="divide-y divide-border border-y border-border">
        {HEADER_KEYS.map((key) => (
          <label key={key} className="grid min-h-9 grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-2 py-1">
            <span className="text-xs text-muted-foreground">{key === 'FILE' ? 'File' : 'Mode'}</span>
            {key === 'MODE' ? (
              <Select
                className="h-7 font-mono text-xs"
                value={draft.MODE ?? ''}
                placeholder="Select mode"
                options={OPERATION_MODES.map((mode) => ({ value: mode, label: mode }))}
                onChange={(event) => setDraft((prev) => ({ ...prev, MODE: event.target.value }))}
              />
            ) : (
              <input
                value={draft[key] ?? ''}
                onChange={(event) => setDraft((prev) => ({ ...prev, [key]: event.target.value }))}
                className="h-7 w-full rounded-md border border-border bg-background px-2 text-xs font-mono text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="Relative path"
              />
            )}
          </label>
        ))}
        {presentDirectiveKeys.map((key) => (
          <label key={key} className="grid min-h-9 grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-2 py-1">
            <span className="text-xs text-muted-foreground">{key}</span>
            <input
              value={draft[key] ?? ''}
              onChange={(event) => setDraft((prev) => ({ ...prev, [key]: event.target.value }))}
              className="h-7 w-full rounded-md border border-border bg-background px-2 text-xs font-mono text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder={key}
            />
          </label>
        ))}
        {missingDirectiveKeys.length > 0 && <label className="grid min-h-9 grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-2 py-1">
          <span className="text-xs text-muted-foreground">Add</span>
          <Select
            className="h-7 text-xs"
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
        </label>}
        <div className="flex justify-end py-1.5">
          <Button
            size="icon"
            type="button"
            className="h-7 w-7"
            onClick={() => onSave(draft)}
            aria-label="Save directives"
            title="Save directives"
          >
            <Save className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </InspectorPropertyGroup>
  );
}

function HistoryPanelContent() {
  const { state } = useAppStateContext();
  const { restoreItem, restoreGroup } = useHistoryActions();
  const activeItems = state.historyItems.filter((item) => !item.restoredAt);
  const restoredItems = state.historyItems.filter((item) => !!item.restoredAt);

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
    })).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [activeItems]);

  const formatTimestamp = (timestamp?: string) => {
    if (!timestamp) return 'Unknown time';
    const date = new Date(timestamp);
    if (Number.isNaN(date.valueOf())) return timestamp;
    return date.toLocaleString();
  };

  return (
    <div className="space-y-4 py-3">
      {groupedHistory.length === 0 && restoredItems.length === 0 && (
        <p className="py-3 text-xs text-muted-foreground">No applied blocks to restore yet.</p>
      )}

      {groupedHistory.map((group) => (
        <div key={group.applyId} className="border-b border-border pb-4">
          <div className="mb-2 flex items-start justify-between gap-2">
            <div>
              <p className="text-[10px] text-muted-foreground">Applied {formatTimestamp(group.createdAt)}</p>
              <p className="text-xs font-semibold">{group.items.length} block{group.items.length === 1 ? '' : 's'}</p>
            </div>
            {group.items.length > 1 && (
              <Button
                variant="ghost"
                size="icon"
                type="button"
                onClick={() => restoreGroup(group.applyId)}
                disabled={state.isRestoringInProgress}
                className="h-7 w-7"
                aria-label="Restore all changes in this apply"
                title="Restore all"
              >
                <RotateCcw className="h-3 w-3" />
              </Button>
            )}
          </div>
          <div className="space-y-1">
            {group.items.map((item) => {
              const meta = item.restoreMeta ?? {
                file: item.file,
                lineCount: item.restorePayload?.newContent.split('\n').length ?? 0,
                language: getLanguageFromFilename(item.file),
                mode: item.mode,
              };
              return (
                <FileListEntry
                  key={item.id}
                  file={meta.file}
                  lineCount={meta.lineCount}
                  language={meta.language}
                  mode={meta.mode}
                  status="applied"
                  actions={
                    <Button
                      variant="ghost"
                      size="icon"
                      type="button"
                      className="h-6 w-6"
                      onClick={() => restoreItem(item)}
                      disabled={state.isRestoringInProgress}
                      aria-label={`Restore ${meta.file}`}
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

      {restoredItems.length > 0 && (
        <div className="mt-6">
          <div className="mb-2 border-b border-border pb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Restored</span>
          </div>
          <div className="space-y-1 opacity-60 grayscale-[0.5]">
            {restoredItems.sort((a, b) => (b.restoredAt || '').localeCompare(a.restoredAt || '')).map((item) => {
              const meta = item.restoreMeta ?? {
                file: item.file,
                lineCount: item.restorePayload?.newContent.split('\n').length ?? 0,
                language: getLanguageFromFilename(item.file),
                mode: item.mode,
              };
              return (
                <div key={item.id} className="relative">
                   <FileListEntry
                    file={meta.file}
                    lineCount={meta.lineCount}
                    language={meta.language}
                    mode={meta.mode}
                    status="applied"
                  />
                  <div className="mt-0.5 px-2 text-[9px] text-muted-foreground">
                    Restored {formatTimestamp(item.restoredAt)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function DiagnosticsSection({
  groups,
  onNavigate,
}: {
  groups: DiagnosticGroup[];
  onNavigate: (target: { blockId: string; line?: number }) => void;
}) {
  const { updateState } = useAppStateContext();
  const handleCopy = async (group: DiagnosticGroup) => {
    const text = formatDiagnosticGroupForClipboard(group);
    try {
      await navigator.clipboard.writeText(text);
      updateState({ statusMessage: `Copied ${group.title.toLowerCase()}.` });
    } catch {
      updateState({ statusMessage: 'Unable to copy diagnostics.' });
    }
  };

  if (groups.length === 0) {
    return <InspectorEmptyState message="No diagnostics." />;
  }

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <section key={group.id}>
          <div className="mb-1 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{group.title}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              type="button"
              className="h-7 w-7"
              onClick={() => handleCopy(group)}
              aria-label={`Copy ${group.title}`}
              title={`Copy ${group.title}`}
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
          <ul className="divide-y divide-border border-y border-border text-xs">
            {group.messages.map((message, index) => {
              const target = group.targetsByMessage?.[message];
              return (
                <li key={`${group.id}-${index}`} className="flex items-start gap-2 py-2">
                  {group.severity === 'error' ? (
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-destructive" />
                  ) : (
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-600" />
                  )}
                  {target ? (
                    <button
                      type="button"
                      className="min-w-0 flex-1 break-words text-left leading-relaxed text-foreground transition-colors hover:text-primary"
                      onClick={() => onNavigate(target)}
                      title={target.line ? `Go to line ${target.line}` : 'Go to block'}
                    >
                      {message}
                    </button>
                  ) : (
                    <p className="min-w-0 flex-1 break-words leading-relaxed text-foreground">{message}</p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

function InspectorPropertyGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

function InspectorEmptyState({ message }: { message: string }) {
  return <p className="py-4 text-center text-xs text-muted-foreground">{message}</p>;
}

function InspectorRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="grid min-h-8 grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-2 py-1.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn('min-w-0 break-words text-foreground', mono && 'font-mono text-[11px]')} title={value}>{value}</dd>
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
