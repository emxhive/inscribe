import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { Clock } from 'lucide-react';
import { Modal } from '@/components/common';
import { Button } from '@/components/ui/button';
import { useAppStateContext } from '@/hooks';
import { getPathBasename } from '@/utils';
import { getKeyboardShortcutDisplay } from '@/utils/keyboardShortcuts';
import { getNextRecentRepositoryIndex } from '@/utils/recentRepositories';

type RecentRepositoriesProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenRepository: () => void;
};

export function RecentRepositories({
  open,
  onOpenChange,
  onOpenRepository,
}: RecentRepositoriesProps) {
  const { state } = useAppStateContext();

  const [recentProjects, setRecentProjects] =
    useState<string[]>([]);

  const [
    selectedRecentProject,
    setSelectedRecentProject,
  ] = useState<string | null>(null);

  const dropdownRef =
    useRef<HTMLDivElement>(null);

  const triggerRef =
    useRef<HTMLButtonElement>(null);

  useEffect(() => {
    window.inscribeAPI
      .getRecentProjects()
      .then(setRecentProjects);

    return window.inscribeAPI
      .onRecentProjectsUpdated(
        setRecentProjects,
      );
  }, []);

  useEffect(() => {
    const handleClickOutside = (
      event: MouseEvent,
    ) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(
          event.target as Node,
        )
      ) {
        onOpenChange(false);
      }
    };

    document.addEventListener(
      'mousedown',
      handleClickOutside,
    );

    return () =>
      document.removeEventListener(
        'mousedown',
        handleClickOutside,
      );
  }, [onOpenChange]);

  useEffect(() => {
    if (!open) {
      return;
    }

    dropdownRef.current
      ?.querySelector<HTMLButtonElement>(
        '[data-recent-item="true"]',
      )
      ?.focus();
  }, [open, recentProjects]);

  useEffect(() => {
    if (!state.isRestoringInProgress) {
      return;
    }

    onOpenChange(false);
    setSelectedRecentProject(null);
  }, [
    onOpenChange,
    state.isRestoringInProgress,
  ]);

  const handleKeyDown = (
    event: KeyboardEvent<HTMLDivElement>,
  ) => {
    const recentItems = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>(
        '[data-recent-item="true"]',
      ),
    );

    if (event.key === 'Escape') {
      event.preventDefault();
      onOpenChange(false);
      triggerRef.current?.focus();
      return;
    }

    if (recentItems.length === 0) {
      return;
    }

    const currentIndex =
      recentItems.indexOf(
        document.activeElement as HTMLButtonElement,
      );

    let nextIndex: number | null = null;

    if (event.key === 'ArrowDown') {
      nextIndex =
        getNextRecentRepositoryIndex(
          currentIndex,
          recentItems.length,
          'next',
        );
    } else if (
      event.key === 'ArrowUp'
    ) {
      nextIndex =
        getNextRecentRepositoryIndex(
          currentIndex,
          recentItems.length,
          'previous',
        );
    } else if (event.key === 'Home') {
      nextIndex =
        getNextRecentRepositoryIndex(
          currentIndex,
          recentItems.length,
          'first',
        );
    } else if (event.key === 'End') {
      nextIndex =
        getNextRecentRepositoryIndex(
          currentIndex,
          recentItems.length,
          'last',
        );
    }

    if (nextIndex !== null) {
      event.preventDefault();
      recentItems[nextIndex]?.focus();
    }
  };

  const handleRecentClick = (
    path: string,
  ) => {
    if (state.isRestoringInProgress) {
      return;
    }

    setSelectedRecentProject(path);
    onOpenChange(false);
  };

  const handleOpenRecentProject = (
    target:
      | 'same-window'
      | 'new-window',
  ) => {
    if (
      !selectedRecentProject ||
      state.isRestoringInProgress
    ) {
      return;
    }

    window.inscribeAPI.openRepository(
      selectedRecentProject,
      target,
    );

    setSelectedRecentProject(null);
  };

  return (
    <>
      {recentProjects.length > 0 && (
        <button
          ref={triggerRef}
          className="absolute right-1.5 rounded-sm p-1 hover:bg-accent hover:text-accent-foreground"
          onClick={() =>
            onOpenChange(!open)
          }
          disabled={
            state.isRestoringInProgress
          }
          title={`Recent projects (${getKeyboardShortcutDisplay('open-recent-repositories')})`}
          type="button"
        >
          <Clock className="h-3.5 w-3.5" />
        </button>
      )}

      {open && (
        <div
          ref={dropdownRef}
          onKeyDown={handleKeyDown}
          data-inscribe-shortcut-overlay="true"
          className="absolute left-0 top-full z-[100] mt-1 max-h-[min(32rem,60vh)] w-[28rem] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-md border border-border bg-popover py-1 shadow-lg"
        >
          <div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Recent Projects
          </div>

          {recentProjects.length > 0 ? (
            recentProjects.map((path) => (
              <button
                key={path}
                data-recent-item="true"
                className="w-full truncate px-3 py-2 text-left text-xs hover:bg-accent hover:text-accent-foreground"
                onClick={() =>
                  handleRecentClick(path)
                }
                title={path}
                type="button"
              >
                <div className="truncate font-medium">
                  {getPathBasename(path)}
                </div>

                <div className="truncate text-[10px] text-muted-foreground">
                  {path}
                </div>
              </button>
            ))
          ) : (
            <div className="px-3 py-3 text-xs text-muted-foreground">
              <p>
                No recent repositories yet.
              </p>

              <Button
                data-recent-item="true"
                variant="outline"
                size="sm"
                className="mt-2 h-7"
                type="button"
                disabled={
                  state.isRestoringInProgress
                }
                onClick={() => {
                  onOpenChange(false);
                  onOpenRepository();
                }}
              >
                Open Repository
              </Button>
            </div>
          )}
        </div>
      )}

      <Modal
        isOpen={
          Boolean(selectedRecentProject) &&
          !state.isRestoringInProgress
        }
        onClose={() =>
          setSelectedRecentProject(null)
        }
        title="Open Project"
        footer={
          <>
            <Button
              variant="outline"
              type="button"
              onClick={() =>
                setSelectedRecentProject(
                  null,
                )
              }
            >
              Cancel
            </Button>

            <Button
              variant="outline"
              type="button"
              onClick={() =>
                handleOpenRecentProject(
                  'same-window',
                )
              }
            >
              Open in This Window
            </Button>

            <Button
              type="button"
              onClick={() =>
                handleOpenRecentProject(
                  'new-window',
                )
              }
            >
              Open in New Window
            </Button>
          </>
        }
      >
        <div className="space-y-2 text-sm">
          <p className="text-foreground">
            How do you want to open this
            project?
          </p>

          <p className="break-all rounded-md border border-border bg-secondary/60 px-3 py-2 font-mono text-xs text-muted-foreground">
            {selectedRecentProject}
          </p>
        </div>
      </Modal>
    </>
  );
}