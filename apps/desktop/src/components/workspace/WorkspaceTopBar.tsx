import React from 'react';
import {
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
import { useAppStateContext } from '@/hooks';
import { cn } from '@/lib/utils';
import { getKeyboardShortcutDisplay } from '@/utils/keyboardShortcuts';
import { RecentRepositories } from './RecentRepositories';

type WorkspaceTopBarProps = {
  onOpenIgnore: () => void;
  onOpenIndexedList: () => void;
  onReplaceIntakeFromClipboard: () => void;
  onUploadIntake: () => void;
  onOpenRepository: () => void;
  onToggleHistory: () => void;
  showRecentRepositories: boolean;
  onShowRecentRepositoriesChange: (
    open: boolean,
  ) => void;
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
  const { state, updateState } =
    useAppStateContext();

  const hasRepository =
    Boolean(state.repoRoot);

  const requireRepository = (
    action: () => void,
    message: string,
  ) => {
    if (!hasRepository) {
      updateState({
        statusMessage: message,
      });

      return;
    }

    action();
  };

  return (
    <header className="relative z-50 flex h-11 flex-shrink-0 items-center gap-2 border-b border-border bg-card px-3">
      <ChromeButton
        onClick={() =>
          updateState({
            isLeftPanelCollapsed:
              !state.isLeftPanelCollapsed,
          })
        }
        title={
          state.isLeftPanelCollapsed
            ? 'Show left panel'
            : 'Hide left panel'
        }
        aria-label={
          state.isLeftPanelCollapsed
            ? 'Show left panel'
            : 'Hide left panel'
        }
        active={
          !state.isLeftPanelCollapsed
        }
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

          <RecentRepositories
            open={showRecentRepositories}
            onOpenChange={
              onShowRecentRepositoriesChange
            }
            onOpenRepository={
              onOpenRepository
            }
          />
        </div>

        <Button
          variant="outline"
          size="icon"
          type="button"
          className="h-7 w-7"
          title={`Open repository (${getKeyboardShortcutDisplay('open-repository')})`}
          aria-label="Browse for repository"
          onClick={onOpenRepository}
          disabled={
            state.isRestoringInProgress
          }
        >
          <Folder className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="ml-auto flex items-center gap-1">
        <ChromeButton
          active={
            state.mode === 'intake'
          }
          onClick={() =>
            updateState({
              mode: 'intake',
            })
          }
        >
          Intake
        </ChromeButton>

        <ChromeButton
          onClick={
            onReplaceIntakeFromClipboard
          }
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
          active={
            state.mode === 'review'
          }
          onClick={() =>
            updateState({
              mode: 'review',
            })
          }
          disabled={
            state.reviewItems.length ===
            0
          }
        >
          Review
        </ChromeButton>

        <span className="mx-1 h-4 w-px bg-border" />

        <ChromeButton
          disabled={!hasRepository}
          onClick={() =>
            requireRepository(
              onOpenIgnore,
              'Select a repository to edit ignore rules.',
            )
          }
        >
          Ignore {state.ignore.entries.length}
        </ChromeButton>

        <ChromeButton
          onClick={onOpenIndexedList}
        >
          Indexed {state.indexedCount}
        </ChromeButton>

        <ChromeButton
          active={
            state.rightPanelOwner ===
              'history' &&
            !state.isRightPanelCollapsed
          }
          onClick={onToggleHistory}
          title={`History (${getKeyboardShortcutDisplay('open-history')})`}
        >
          <History className="h-3.5 w-3.5" />
        </ChromeButton>

        <ChromeButton
          onClick={() =>
            updateState({
              statusMessage:
                'Settings (placeholder)',
            })
          }
          title="Settings"
        >
          <Settings className="h-3.5 w-3.5" />
        </ChromeButton>

        <ChromeButton
          onClick={
            onShowKeyboardShortcuts
          }
          title={`Keyboard shortcuts (${getKeyboardShortcutDisplay('show-keyboard-shortcuts')})`}
          aria-label="Keyboard shortcuts"
        >
          <Keyboard className="h-3.5 w-3.5" />
        </ChromeButton>

        <ChromeButton
          onClick={() =>
            updateState({
              isTerminalOpen:
                !state.isTerminalOpen,
            })
          }
          title={`${state.isTerminalOpen ? 'Hide terminal' : 'Show terminal'} (${getKeyboardShortcutDisplay('toggle-terminal')})`}
          aria-label={
            state.isTerminalOpen
              ? 'Hide terminal'
              : 'Show terminal'
          }
          active={state.isTerminalOpen}
        >
          <SquareTerminal className="h-3.5 w-3.5" />
        </ChromeButton>

        <ChromeButton
          onClick={() =>
            updateState({
              isRightPanelCollapsed:
                !state.isRightPanelCollapsed,
            })
          }
          title={
            state.isRightPanelCollapsed
              ? 'Show right panel'
              : 'Hide right panel'
          }
          aria-label={
            state.isRightPanelCollapsed
              ? 'Show right panel'
              : 'Hide right panel'
          }
          active={
            !state.isRightPanelCollapsed
          }
        >
          <PanelRight className="h-3.5 w-3.5" />
        </ChromeButton>
      </div>
    </header>
  );
}

function ChromeButton({
  active,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
}) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex h-7 items-center justify-center gap-1 rounded-md px-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-45',
        active &&
          'bg-primary/10 text-foreground',
        className,
      )}
      {...props}
    />
  );
}