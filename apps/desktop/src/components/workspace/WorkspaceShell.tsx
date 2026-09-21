import { useEffect, useState } from "react";

import {
  useAppStateContext,
  useHistoryActions,
  useIntakeImportActions,
  usePrimaryAction,
  useRepositoryActions,
  useWorkspacePanels,
  useWorkspaceShortcuts,
} from "@/hooks";

import { FileSidebar } from "./FileSidebar";
import { IntakePanel } from "../intake/IntakePanel";
import { ReviewPanel } from "../review/ReviewPanel";
import { HistoryReviewPanel } from "../history/HistoryReviewPanel";
import { RightPanel } from "../inspector/RightPanel";
import { WorkspaceTopBar } from "./WorkspaceTopBar";
import { WorkspaceBottomBar } from "./WorkspaceBottomBar";
import { KeyboardShortcutsModal } from "../KeyboardShortcutsModal";

import { TerminalPanel } from "../terminal/TerminalPanel";
import { cn } from "@/lib/utils";

type WorkspaceShellProps = {
  onOpenIgnore: () => void;
  onOpenIndexedList: () => void;
};

export function WorkspaceShell({
  onOpenIgnore,
  onOpenIndexedList,
}: WorkspaceShellProps) {
  const { state, updateState } = useAppStateContext();
  const repositoryActions = useRepositoryActions();
  const historyActions = useHistoryActions();
  const primaryAction = usePrimaryAction();
  const { replaceIntakeFromClipboard, uploadIntake } = useIntakeImportActions();
  const [showRecentRepositories, setShowRecentRepositories] = useState(false);
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  const { sidebarWidth, handleSidebarResize, workspaceColumns, toggleHistory } =
    useWorkspacePanels();

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

  const hasAppliedReview =
    state.mode === "review" &&
    state.reviewItems.length > 0 &&
    state.reviewItems.every((item) => item.status === "applied");

  const revertChanges = () => {
    if (
      !state.lastAppliedActionId ||
      !hasAppliedReview ||
      state.isParsingInProgress ||
      state.isApplyingInProgress ||
      state.isRestoringInProgress ||
      state.historyReview.actionId
    ) {
      return;
    }

    void historyActions.openRestoreReview(
      state.lastAppliedActionId,
      "revert",
    );
  };

  const workspaceRef = useWorkspaceShortcuts({
    replaceIntakeFromClipboard,
    uploadIntake,
    openRepository: repositoryActions.handleBrowseRepo,
    onShowRecentRepositoriesChange: setShowRecentRepositories,
    toggleHistory,
    onShowKeyboardShortcutsChange: setShowKeyboardShortcuts,
    revertChanges,
    runPrimaryAction: primaryAction.run,
  });

  return (
    <div
      ref={workspaceRef}
      tabIndex={-1}
      className="flex h-screen flex-col overflow-hidden bg-background outline-none"
    >
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
          {!state.isRestoringRepo && state.historyReview.actionId && (
            <HistoryReviewPanel />
          )}
          {!state.isRestoringRepo &&
            !state.historyReview.actionId &&
            state.mode === "intake" && <IntakePanel />}
          {!state.isRestoringRepo &&
            !state.historyReview.actionId &&
            state.mode === "review" && <ReviewPanel />}
        </main>
        {!state.isRightPanelCollapsed && <RightPanel />}
      </div>
      {Boolean(state.repoRoot) &&
        (state.isTerminalOpen || hasMountedTerminal) && (
          <div className={cn(state.isTerminalOpen ? "block" : "hidden")}>
            <TerminalPanel
              repoRoot={state.repoRoot}
              suggestions={state.terminalCommandSuggestions}
              isOpen={state.isTerminalOpen}
              onClose={() => updateState({ isTerminalOpen: false })}
            />
          </div>
        )}
      <WorkspaceBottomBar
        primaryAction={primaryAction.action}
        onRunPrimaryAction={primaryAction.run}
        onRevertChanges={revertChanges}
      />
      <KeyboardShortcutsModal
        isOpen={showKeyboardShortcuts}
        onClose={() => setShowKeyboardShortcuts(false)}
      />
    </div>
  );
}