import React, { useEffect, useRef, useState } from 'react';
import {
  Clock,
  ClipboardPaste,
  Folder,
  History,
  Keyboard,
  PanelLeft,
  PanelRight,
  Settings,
  SquareTerminal,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/common';
import { useAppStateContext } from '@/hooks';
import { getPathBasename } from '@/utils';
import { cn } from '@/lib/utils';
import { getNextRecentRepositoryIndex } from '@/utils/recentRepositories';
import { getKeyboardShortcutDisplay } from '@/utils/keyboardShortcuts';

type WorkspaceTopBarProps = {
  onOpenIgnore: () => void;
  onOpenIndexedList: () => void;
  onReplaceIntakeFromClipboard: () => void;
  onUploadIntake: () => void;
  onOpenRepository: () => void;
  onToggleHistory: () => void;
  showRecentRepositories: boolean;
  onShowRecentRepositoriesChange: (open: boolean) => void;
  onShowKeyboardShortcuts: () => void;
};

export function WorkspaceTopBar({
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

  useEffect(() => {
    if (!state.isRestoringInProgress) return;
    onShowRecentRepositoriesChange(false);
    setSelectedRecentProject(null);
  }, [onShowRecentRepositoriesChange, state.isRestoringInProgress]);

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
    if (state.isRestoringInProgress) return;
    setSelectedRecentProject(path);
    onShowRecentRepositoriesChange(false);
  };

  const handleOpenRecentProject = (target: 'same-window' | 'new-window') => {
    if (!selectedRecentProject || state.isRestoringInProgress) return;
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
              disabled={state.isRestoringInProgress}
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
                    disabled={state.isRestoringInProgress}
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
          disabled={state.isRestoringInProgress}
        >
          <Folder className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="ml-auto flex items-center gap-1">
        <ChromeButton
          active={state.mode === 'intake'}
          onClick={() => updateState({ mode: 'intake' })}
        >
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

        <ChromeButton
          disabled={!hasRepository}
          onClick={() => requireRepository(onOpenIgnore, 'Select a repository to edit ignore rules.')}
        >
          Ignore {state.ignore.entries.length}
        </ChromeButton>

        <ChromeButton onClick={onOpenIndexedList}>
          Indexed {state.indexedCount}
        </ChromeButton>

        <ChromeButton
          active={state.rightPanelOwner === 'history' && !state.isRightPanelCollapsed}
          onClick={onToggleHistory}
          title={`History (${getKeyboardShortcutDisplay('open-history')})`}
        >
          <History className="h-3.5 w-3.5" />
        </ChromeButton>

        <ChromeButton
          onClick={() => updateState({ statusMessage: 'Settings (placeholder)' })}
          title="Settings"
        >
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
        isOpen={Boolean(selectedRecentProject) && !state.isRestoringInProgress}
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