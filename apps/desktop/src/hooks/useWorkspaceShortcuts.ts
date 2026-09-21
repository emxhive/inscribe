import { useEffect, useRef } from 'react';
import { useAppStateContext } from '@/hooks';
import {
  KEYBOARD_SHORTCUTS,
  hasBlockingShortcutOverlay,
  isEditorKeyboardTarget,
  isInteractiveKeyboardTarget,
  isTextEditingKeyboardTarget,
  matchesKeyboardShortcut,
  shouldHandleKeyboardShortcut,
} from '@/utils/keyboardShortcuts';

type WorkspaceAction = () => void | Promise<void>;

type WorkspaceShortcutOptions = {
  replaceIntakeFromClipboard: WorkspaceAction;
  uploadIntake: WorkspaceAction;
  openRepository: WorkspaceAction;
  onShowRecentRepositoriesChange: (open: boolean) => void;
  toggleHistory: () => void;
  onShowKeyboardShortcutsChange: (open: boolean) => void;
  runPrimaryAction: WorkspaceAction;
};

export function useWorkspaceShortcuts({
  replaceIntakeFromClipboard,
  uploadIntake,
  openRepository,
  onShowRecentRepositoriesChange,
  toggleHistory,
  onShowKeyboardShortcutsChange,
  runPrimaryAction,
}: WorkspaceShortcutOptions) {
  const { state, updateState } = useAppStateContext();
  const workspaceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;

      if (
        event.key === 'Escape' &&
        !hasBlockingShortcutOverlay() &&
        isEditorKeyboardTarget(event.target)
      ) {
        event.preventDefault();

        if (event.target instanceof HTMLElement) {
          event.target.blur();
        }

        workspaceRef.current?.focus({ preventScroll: true });
        return;
      }

      const shortcut = KEYBOARD_SHORTCUTS.find((candidate) =>
        matchesKeyboardShortcut(event, candidate),
      );

      if (
        !shortcut ||
        !shouldHandleKeyboardShortcut(
          event,
          shortcut,
          isInteractiveKeyboardTarget(event.target),
          hasBlockingShortcutOverlay(),
          isTextEditingKeyboardTarget(event.target),
          state.isRestoringInProgress,
        )
      ) {
        return;
      }

      event.preventDefault();

      switch (shortcut.id) {
        case 'paste-intake':
          void replaceIntakeFromClipboard();
          break;

        case 'open-repository':
          void openRepository();
          break;

        case 'open-recent-repositories':
          onShowRecentRepositoriesChange(true);
          break;

        case 'open-history':
          toggleHistory();
          break;

        case 'open-intake-file':
          void uploadIntake();
          break;

        case 'toggle-terminal':
          updateState((prev) => ({
            isTerminalOpen: !prev.isTerminalOpen,
          }));
          break;

        case 'show-keyboard-shortcuts':
          onShowKeyboardShortcutsChange(true);
          break;

        case 'primary-action':
          void runPrimaryAction();
          break;
      }
    };

    window.addEventListener('keydown', handleShortcut);

    return () => {
      window.removeEventListener('keydown', handleShortcut);
    };
  }, [
    onShowKeyboardShortcutsChange,
    onShowRecentRepositoriesChange,
    openRepository,
    replaceIntakeFromClipboard,
    runPrimaryAction,
    state.isRestoringInProgress,
    toggleHistory,
    updateState,
    uploadIntake,
  ]);

  return workspaceRef;
}