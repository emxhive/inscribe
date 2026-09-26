import {
  useEffect,
  useState,
  type ChangeEvent,
  type MouseEvent,
  type PointerEvent,
} from 'react';
import '@xterm/xterm/css/xterm.css';
import {
  AlertCircle,
  Copy,
  RotateCcw,
  SquareTerminal,
  X,
} from 'lucide-react';
import type { CliCommandSuggestion } from '@inscribe/shared';
import { Button } from '@/components/ui/button';
import type { TerminalShellPreference } from '@/types';
import { useTerminalSession } from '@/hooks/terminal/useTerminalSession';

interface TerminalPanelProps {
  repoRoot: string | null;
  suggestions: CliCommandSuggestion[];
  isOpen: boolean;
  onClose: () => void;
}

const TERMINAL_SHELL_STORAGE_KEY =
  'inscribe:terminal:shellPreference';

const TERMINAL_HEIGHT_STORAGE_KEY =
  'inscribe:terminal:height';

const TERMINAL_DEFAULT_HEIGHT = 256;
const TERMINAL_MIN_HEIGHT = 120;
const TERMINAL_MAX_VIEWPORT_RATIO = 0.7;

const TERMINAL_SHELL_OPTIONS: Array<{
  value: TerminalShellPreference;
  label: string;
}> = [
  {
    value: 'bash',
    label: 'Bash',
  },
  {
    value: 'auto',
    label: 'Auto',
  },
  {
    value: 'powershell',
    label: 'PowerShell',
  },
  {
    value: 'cmd',
    label: 'cmd',
  },
];

function clampTerminalHeight(
  height: number,
): number {
  const maxHeight =
    typeof window === 'undefined'
      ? TERMINAL_DEFAULT_HEIGHT
      : Math.max(
          TERMINAL_MIN_HEIGHT,
          Math.floor(
            window.innerHeight *
              TERMINAL_MAX_VIEWPORT_RATIO,
          ),
        );

  return Math.min(
    maxHeight,
    Math.max(
      TERMINAL_MIN_HEIGHT,
      height,
    ),
  );
}

function getInitialTerminalHeight(): number {
  if (typeof window === 'undefined') {
    return TERMINAL_DEFAULT_HEIGHT;
  }

  const stored = Number(
    window.localStorage.getItem(
      TERMINAL_HEIGHT_STORAGE_KEY,
    ),
  );

  return clampTerminalHeight(
    Number.isFinite(stored)
      ? stored
      : TERMINAL_DEFAULT_HEIGHT,
  );
}

function getInitialShellPreference():
  TerminalShellPreference {
  if (typeof window === 'undefined') {
    return 'bash';
  }

  const stored =
    window.localStorage.getItem(
      TERMINAL_SHELL_STORAGE_KEY,
    );

  if (
    stored === 'auto' ||
    stored === 'bash' ||
    stored === 'powershell' ||
    stored === 'cmd'
  ) {
    return stored;
  }

  return 'bash';
}

export function TerminalPanel({
  repoRoot,
  suggestions,
  isOpen,
  onClose,
}: TerminalPanelProps) {
  const [
    shellPreference,
    setShellPreference,
  ] = useState<TerminalShellPreference>(
    getInitialShellPreference,
  );

  const [
    terminalHeight,
    setTerminalHeight,
  ] = useState(
    getInitialTerminalHeight,
  );

  const [selectionMenu, setSelectionMenu] = useState<{
    x: number;
    y: number;
    text: string;
  } | null>(null);

  const {
    terminalElementRef,
    activeSessionId,
    shellInfo,
    terminalError,
    isExited,
    hasLastInteraction,
    restart,
    copyAll,
    copyLast,
    copySelection,
    getSelection,
  } = useTerminalSession({
    repoRoot,
    suggestions,
    isOpen,
    shellPreference,
  });

  useEffect(() => {
    if (!selectionMenu) return;

    const dismiss = () => setSelectionMenu(null);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismiss();
    };

    window.addEventListener('pointerdown', dismiss);
    window.addEventListener('resize', dismiss);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('pointerdown', dismiss);
      window.removeEventListener('resize', dismiss);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectionMenu]);

  const handleTerminalContextMenu = (
    event: MouseEvent<HTMLDivElement>,
  ) => {
    const terminalText = getSelection();

    if (!terminalText) return;

    event.preventDefault();
    event.stopPropagation();
    setSelectionMenu({
      x: Math.max(0, Math.min(event.clientX, window.innerWidth - 160)),
      y: Math.max(0, Math.min(event.clientY, window.innerHeight - 48)),
      text: terminalText,
    });
  };

  const handleShellPreferenceChange = (
    event: ChangeEvent<HTMLSelectElement>,
  ) => {
    const nextPreference =
      event.target.value as TerminalShellPreference;

    setShellPreference(nextPreference);

    if (
      typeof window !== 'undefined'
    ) {
      window.localStorage.setItem(
        TERMINAL_SHELL_STORAGE_KEY,
        nextPreference,
      );
    }
  };

  const handleResizePointerDown = (
    event: PointerEvent<HTMLDivElement>,
  ) => {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();

    const startY = event.clientY;
    const startHeight = terminalHeight;

    let nextHeight = startHeight;

    const previousCursor =
      document.body.style.cursor;

    const previousUserSelect =
      document.body.style.userSelect;

    document.body.style.cursor =
      'row-resize';

    document.body.style.userSelect =
      'none';

    const handlePointerMove = (
      moveEvent: globalThis.PointerEvent,
    ) => {
      nextHeight = clampTerminalHeight(
        startHeight +
          startY -
          moveEvent.clientY,
      );

      setTerminalHeight(nextHeight);
    };

    const finishResize = () => {
      window.removeEventListener(
        'pointermove',
        handlePointerMove,
      );

      window.removeEventListener(
        'pointerup',
        finishResize,
      );

      window.removeEventListener(
        'pointercancel',
        finishResize,
      );

      document.body.style.cursor =
        previousCursor;

      document.body.style.userSelect =
        previousUserSelect;

      window.localStorage.setItem(
        TERMINAL_HEIGHT_STORAGE_KEY,
        String(nextHeight),
      );
    };

    window.addEventListener(
      'pointermove',
      handlePointerMove,
    );

    window.addEventListener(
      'pointerup',
      finishResize,
    );

    window.addEventListener(
      'pointercancel',
      finishResize,
    );
  };

  return (
    <div
      className="relative flex flex-col border-t border-border bg-card text-foreground"
      style={{
        height: terminalHeight,
      }}
    >
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize terminal"
        title="Drag to resize terminal"
        onPointerDown={
          handleResizePointerDown
        }
        className="absolute inset-x-0 top-0 z-20 h-1 cursor-row-resize transition-colors hover:bg-primary/40"
      />

      <div className="flex h-9 items-center justify-between border-b border-border bg-card px-3 text-xs">
        <div className="flex items-center gap-2.5">
          <SquareTerminal className="h-4 w-4 text-primary" />

          <span className="font-semibold text-foreground">
            Terminal
          </span>

          {shellInfo && (
            <span
              className="max-w-[240px] truncate font-mono text-xs text-muted-foreground"
              title={shellInfo}
            >
              ({shellInfo})
            </span>
          )}

          {isExited && (
            <span className="rounded bg-destructive/15 px-1.5 py-0.5 text-[11px] font-medium text-destructive">
              Exited
            </span>
          )}

          {terminalError && (
            <span
              className="flex items-center gap-1 text-xs text-destructive"
              title={terminalError}
            >
              <AlertCircle className="h-3.5 w-3.5" />
              Failed to start
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <select
            value={shellPreference}
            onChange={
              handleShellPreferenceChange
            }
            className="h-7 rounded border border-input bg-background px-2.5 py-1 text-xs font-medium text-foreground hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            aria-label="Select terminal shell"
          >
            {TERMINAL_SHELL_OPTIONS.map(
              (option) => (
                <option
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </option>
              ),
            )}
          </select>

          <Button
            variant="ghost"
            size="icon"
            className="group h-7 w-7 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            onClick={() =>
              void copyLast()
            }
            title="Copy last command + output"
            aria-label="Copy last command and output"
            disabled={
              !activeSessionId ||
              !hasLastInteraction
            }
          >
            <span className="relative flex h-4 w-4 items-center justify-center">
              <Copy className="h-3.5 w-3.5" />
              <span className="absolute -bottom-0.5 -right-0.5 rounded-[1px] bg-card px-[2px] py-px text-[7px] font-black leading-none text-foreground/80 transition-colors group-hover:bg-accent group-hover:text-accent-foreground">
                L
              </span>
            </span>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="group h-7 w-7 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            onClick={() =>
              void copyAll()
            }
            title="Copy all terminal contents"
            aria-label="Copy all terminal contents"
            disabled={!activeSessionId}
          >
            <span className="relative flex h-4 w-4 items-center justify-center">
              <Copy className="h-3.5 w-3.5" />
              <span className="absolute -bottom-0.5 -right-0.5 rounded-[1px] bg-card px-[2px] py-px text-[7px] font-black leading-none text-foreground/80 transition-colors group-hover:bg-accent group-hover:text-accent-foreground">
                A
              </span>
            </span>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            onClick={restart}
            title="Restart terminal"
            aria-label="Restart terminal"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            onClick={onClose}
            title="Hide terminal (Ctrl+`)"
            aria-label="Hide terminal"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div
        className="relative min-h-0 flex-1 overflow-hidden bg-[#090d16] p-1"
        onContextMenuCapture={handleTerminalContextMenu}
      >
        <div
          ref={terminalElementRef}
          className="h-full w-full"
        />
        {selectionMenu && (
          <div
            role="menu"
            aria-label="Terminal selection actions"
            className="fixed z-50 min-w-40 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
            style={{ left: selectionMenu.x, top: selectionMenu.y }}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
              onClick={() => {
                void copySelection(selectionMenu.text);
                setSelectionMenu(null);
              }}
            >
              <Copy className="h-3.5 w-3.5" />
              Copy selection
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
