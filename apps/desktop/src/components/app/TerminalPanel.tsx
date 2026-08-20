import React, { useEffect, useRef, useState } from 'react';
import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import { AlertCircle, Copy, RotateCcw, SquareTerminal, X } from 'lucide-react';
import type { CliCommandSuggestion } from '@inscribe/shared';
import { Button } from '@/components/ui/button';
import type {
  TerminalDataEvent,
  TerminalSessionExitEvent,
  TerminalShellKind,
  TerminalShellPreference,
} from '@/types';
import { buildTerminalLineReplacement } from '@/utils/terminalLineReplacement';

interface TerminalPanelProps {
  repoRoot: string | null;
  suggestions: CliCommandSuggestion[];
  isOpen: boolean;
  onClose: () => void;
}

const TERMINAL_SHELL_STORAGE_KEY = 'inscribe:terminal:shellPreference';
const TERMINAL_HEIGHT_STORAGE_KEY = 'inscribe:terminal:height';
const TERMINAL_DEFAULT_HEIGHT = 256;
const TERMINAL_MIN_HEIGHT = 120;
const TERMINAL_MAX_VIEWPORT_RATIO = 0.7;

function clampTerminalHeight(height: number): number {
  const maxHeight = typeof window === 'undefined'
    ? TERMINAL_DEFAULT_HEIGHT
    : Math.max(TERMINAL_MIN_HEIGHT, Math.floor(window.innerHeight * TERMINAL_MAX_VIEWPORT_RATIO));

  return Math.min(maxHeight, Math.max(TERMINAL_MIN_HEIGHT, height));
}

function getInitialTerminalHeight(): number {
  if (typeof window === 'undefined') return TERMINAL_DEFAULT_HEIGHT;

  const stored = Number(window.localStorage.getItem(TERMINAL_HEIGHT_STORAGE_KEY));
  return clampTerminalHeight(Number.isFinite(stored) ? stored : TERMINAL_DEFAULT_HEIGHT);
}

interface TerminalBufferPosition {
  line: number;
  column: number;
}

function getTerminalBufferPosition(terminal: Terminal): TerminalBufferPosition {
  const buffer = terminal.buffer.active;
  return {
    line: buffer.baseY + buffer.cursorY,
    column: buffer.cursorX,
  };
}

function serializeTerminalRange(
  terminal: Terminal,
  start: TerminalBufferPosition,
  end: TerminalBufferPosition,
): string {
  if (
    end.line < start.line ||
    (end.line === start.line && end.column <= start.column)
  ) {
    return '';
  }

  const buffer = terminal.buffer.active;
  if (buffer.length === 0) return '';

  const firstLine = Math.max(0, Math.min(start.line, buffer.length - 1));
  const lastLine = Math.max(firstLine, Math.min(end.line, buffer.length - 1));
  const logicalLines: string[] = [];

  for (let index = firstLine; index <= lastLine; index++) {
    const line = buffer.getLine(index);
    if (!line) continue;

    const startColumn = index === firstLine ? start.column : 0;
    const endColumn = index === lastLine ? end.column : undefined;
    const text = line.translateToString(true, startColumn, endColumn);

    if (line.isWrapped && logicalLines.length > 0 && index !== firstLine) {
      logicalLines[logicalLines.length - 1] += text;
    } else {
      logicalLines.push(text);
    }
  }

  return logicalLines.join('\n').trimEnd();
}

function serializeTerminalBuffer(terminal: Terminal, startLine = 0): string {
  const buffer = terminal.buffer.active;
  const logicalLines: string[] = [];

  for (let index = Math.max(0, startLine); index < buffer.length; index++) {
    const line = buffer.getLine(index);
    if (!line) continue;

    const text = line.translateToString(true);
    if (line.isWrapped && logicalLines.length > 0) {
      logicalLines[logicalLines.length - 1] += text;
    } else {
      logicalLines.push(text);
    }
  }

  return logicalLines.join('\n').trimEnd();
}

const TERMINAL_SHELL_OPTIONS: Array<{ value: TerminalShellPreference; label: string }> = [
  { value: 'bash', label: 'Bash' },
  { value: 'auto', label: 'Auto' },
  { value: 'powershell', label: 'PowerShell' },
  { value: 'cmd', label: 'cmd' },
];

function getInitialShellPreference(): TerminalShellPreference {
  if (typeof window === 'undefined') return 'bash';
  const stored = window.localStorage.getItem(TERMINAL_SHELL_STORAGE_KEY);
  if (stored === 'auto' || stored === 'bash' || stored === 'powershell' || stored === 'cmd') {
    return stored;
  }
  return 'bash';
}

export function TerminalPanel({ repoRoot, suggestions, isOpen, onClose }: TerminalPanelProps) {
  const terminalElementRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const shellKindRef = useRef<TerminalShellKind>('posix');
  const suggestionsRef = useRef<CliCommandSuggestion[]>(suggestions);
  const suggestionIndexRef = useRef<number>(-1);
  const promptStartRef = useRef<TerminalBufferPosition | null>(null);
  const commandStartedRef = useRef(false);
  const lastInteractionTextRef = useRef('');
  const pendingTerminalDataRef = useRef<Map<string, string[]>>(new Map());

  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [shellInfo, setShellInfo] = useState<string>('');
  const [shellPreference, setShellPreference] = useState<TerminalShellPreference>(getInitialShellPreference);
  const [terminalError, setTerminalError] = useState<string | null>(null);
  const [isExited, setIsExited] = useState(false);
  const [restartCounter, setRestartCounter] = useState(0);
  const [terminalHeight, setTerminalHeight] = useState(getInitialTerminalHeight);
  const [hasLastInteraction, setHasLastInteraction] = useState(false);

  // Keep suggestions ref in sync without re-triggering terminal setup
  useEffect(() => {
    suggestionsRef.current = suggestions;
    suggestionIndexRef.current = -1;
  }, [suggestions]);

  // Terminal instance initialization and PTY lifetime
  useEffect(() => {
    const container = terminalElementRef.current;
    if (!container || !repoRoot) return;

    setTerminalError(null);
    setIsExited(false);
    promptStartRef.current = null;
    commandStartedRef.current = false;
    lastInteractionTextRef.current = '';
    pendingTerminalDataRef.current.clear();
    setHasLastInteraction(false);

    const terminal = new Terminal({
      allowProposedApi: false,
      cursorBlink: true,
      disableStdin: false,
      fontFamily: 'JetBrains Mono, ui-monospace, SFMono-Regular, Consolas, monospace',
      fontSize: 12,
      lineHeight: 1.35,
      scrollback: 5000,
      theme: {
        background: '#090d16',
        foreground: '#e2e8f0',
        cursor: '#60a5fa',
        selectionBackground: '#334155',
      },
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(container);

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // FinalTerm shell integration: A = prompt start, C = execution start,
    // D = execution finished. Copy Last is derived only from these semantic
    // boundaries, never from keyboard events or visual prompt guessing.
    const shellIntegrationDisposable = terminal.parser.registerOscHandler(133, (data) => {
      const event = data.split(';', 1)[0];

      if (event === 'A') {
        promptStartRef.current = getTerminalBufferPosition(terminal);
        commandStartedRef.current = false;
        return true;
      }

      if (event === 'C') {
        commandStartedRef.current = true;
        return true;
      }

      if (event === 'D') {
        const promptStart = promptStartRef.current;
        if (promptStart && commandStartedRef.current) {
          const interaction = serializeTerminalRange(
            terminal,
            promptStart,
            getTerminalBufferPosition(terminal),
          );

          if (interaction) {
            lastInteractionTextRef.current = interaction;
            setHasLastInteraction(true);
          }
        }

        commandStartedRef.current = false;
        return true;
      }

      return false;
    });

    // Direct raw input forwarding to PTY
    const dataDisposable = terminal.onData((data) => {
      const currentSessionId = sessionIdRef.current;
      if (!currentSessionId) return;
      void window.inscribeAPI.terminalWrite(currentSessionId, data);
    });

    // Preserve Ctrl+C for shell interrupts; Ctrl+Shift+C copies selected terminal output.
    terminal.attachCustomKeyEventHandler((event: KeyboardEvent) => {
      if (
        event.type === 'keydown' &&
        event.ctrlKey &&
        event.shiftKey &&
        event.key.toLowerCase() === 'c'
      ) {
        event.preventDefault();
        const selection = terminal.getSelection();
        if (selection) {
          void navigator.clipboard.writeText(selection);
        }
        return false;
      }


      // Keyboard-only suggestion traversal: Ctrl+Up / Ctrl+Down replacing current prompt input
      if (event.type === 'keydown' && event.ctrlKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
        event.preventDefault();
        const currentSuggestions = suggestionsRef.current;
        if (currentSuggestions.length === 0) return false;

        let nextIndex: number;
        if (event.key === 'ArrowUp') {
          if (suggestionIndexRef.current <= 0) {
            nextIndex = currentSuggestions.length - 1;
          } else {
            nextIndex = suggestionIndexRef.current - 1;
          }
        } else {
          if (suggestionIndexRef.current >= currentSuggestions.length - 1 || suggestionIndexRef.current < 0) {
            nextIndex = 0;
          } else {
            nextIndex = suggestionIndexRef.current + 1;
          }
        }

        suggestionIndexRef.current = nextIndex;
        const selectedSuggestion = currentSuggestions[nextIndex];
        const currentSessionId = sessionIdRef.current;

        if (selectedSuggestion && currentSessionId) {
          // Replace current prompt line and write command text without trailing Enter/newline
          const replacement = buildTerminalLineReplacement(shellKindRef.current, selectedSuggestion.command);
          void window.inscribeAPI.terminalWrite(currentSessionId, replacement);
        }
        return false;
      }

      // Plain Up/Down, Enter, Ctrl+C, etc. pass through to xterm/shell naturally
      return true;
    });

    const fitAndResize = () => {
      try {
        const bounds = container.getBoundingClientRect();
        if (bounds.width <= 0 || bounds.height <= 0) {
          return;
        }

        fitAddon.fit();
        const dimensions = { cols: terminal.cols, rows: terminal.rows };
        const currentSessionId = sessionIdRef.current;
        if (currentSessionId && dimensions.cols > 0 && dimensions.rows > 0) {
          void window.inscribeAPI.terminalResize(currentSessionId, dimensions.cols, dimensions.rows);
        }
      } catch {
        // Ignored during layout transitions
      }
    };

    const resizeObserver = new ResizeObserver(fitAndResize);
    resizeObserver.observe(container);

    let isDisposed = false;

    // Fit xterm after layout settles, then create the PTY using the real dimensions.
    requestAnimationFrame(() => {
      if (isDisposed) return;

      fitAndResize();
      if (isDisposed) return;

      void window.inscribeAPI.terminalCreate({
        cwd: repoRoot,
        cols: terminal.cols || 80,
        rows: terminal.rows || 24,
        shellPreference,
      }).then((info) => {
        if (isDisposed) {
          void window.inscribeAPI.terminalDispose(info.sessionId);
          return;
        }
        sessionIdRef.current = info.sessionId;

        const pendingData = pendingTerminalDataRef.current.get(info.sessionId);
        if (pendingData?.length) {
          terminal.write(pendingData.join(''));
        }
        pendingTerminalDataRef.current.clear();

        shellKindRef.current = info.shellKind;
        setActiveSessionId(info.sessionId);
        setShellInfo(info.shell);
        fitAndResize();
        if (isOpen) {
          requestAnimationFrame(() => terminal.focus());
        }
      }).catch((err) => {
        if (isDisposed) return;
        const message = err instanceof Error ? err.message : String(err);
        setTerminalError(message);
        terminal.writeln(`\x1b[31mTerminal startup error: ${message}\x1b[0m`);
      });
    });

    // Listen to incoming raw PTY data and exit events
    const removeDataListener = window.inscribeAPI.onTerminalData((event: TerminalDataEvent) => {
      if (event.sessionId === sessionIdRef.current) {
        terminal.write(event.data);
        return;
      }

      if (sessionIdRef.current === null) {
        const pendingData = pendingTerminalDataRef.current.get(event.sessionId) ?? [];
        pendingData.push(event.data);
        pendingTerminalDataRef.current.set(event.sessionId, pendingData);
      }
    });

    const removeSessionExitListener = window.inscribeAPI.onTerminalSessionExit((event: TerminalSessionExitEvent) => {
      if (event.sessionId !== sessionIdRef.current) return;
      setIsExited(true);
      terminal.writeln(`\r\n\x1b[90m[Process exited with code ${event.exitCode ?? 0}]\x1b[0m`);
    });

    return () => {
      isDisposed = true;
      resizeObserver.disconnect();
      removeDataListener();
      removeSessionExitListener();
      dataDisposable.dispose();
      shellIntegrationDisposable.dispose();
      pendingTerminalDataRef.current.clear();

      if (sessionIdRef.current) {
        void window.inscribeAPI.terminalDispose(sessionIdRef.current);
        sessionIdRef.current = null;
      }

      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
      setActiveSessionId(null);
    };
  }, [repoRoot, shellPreference, restartCounter]);

  // When visibility changes to open, wait for layout, then re-fit and resize the PTY before focusing.
  useEffect(() => {
    if (!isOpen || !terminalRef.current || !fitAddonRef.current) {
      return;
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        void (async () => {
          try {
            const container = terminalElementRef.current;
            const terminal = terminalRef.current;
            const fitAddon = fitAddonRef.current;

            if (!container || !terminal || !fitAddon) {
              return;
            }

            const bounds = container.getBoundingClientRect();
            if (bounds.width <= 0 || bounds.height <= 0) {
              return;
            }

            fitAddon.fit();

            if (sessionIdRef.current && terminal.cols > 0 && terminal.rows > 0) {
              await window.inscribeAPI.terminalResize(
                sessionIdRef.current,
                terminal.cols,
                terminal.rows,
              );
            }

            terminal.focus();
          } catch {
            // Ignored during layout transitions
          }
        })();
      });
    });
  }, [isOpen]);

  const handleShellPreferenceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextPreference = e.target.value as TerminalShellPreference;
    setShellPreference(nextPreference);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(TERMINAL_SHELL_STORAGE_KEY, nextPreference);
    }
  };

  const handleRestart = () => {
    setRestartCounter((c) => c + 1);
  };

  const handleCopyAll = async () => {
    const terminal = terminalRef.current;
    if (!terminal) return;

    const text = serializeTerminalBuffer(terminal);
    if (text) {
      await navigator.clipboard.writeText(text);
    }
  };

  const handleCopyLast = async () => {
    const text = lastInteractionTextRef.current;
    if (text) {
      await navigator.clipboard.writeText(text);
    }
  };

  const handleResizePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;

    event.preventDefault();

    const startY = event.clientY;
    const startHeight = terminalHeight;
    let nextHeight = startHeight;
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;

    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';

    const handlePointerMove = (moveEvent: PointerEvent) => {
      nextHeight = clampTerminalHeight(startHeight + startY - moveEvent.clientY);
      setTerminalHeight(nextHeight);
    };

    const finishResize = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', finishResize);
      window.removeEventListener('pointercancel', finishResize);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      window.localStorage.setItem(TERMINAL_HEIGHT_STORAGE_KEY, String(nextHeight));
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', finishResize);
    window.addEventListener('pointercancel', finishResize);
  };

  return (
    <div
      className="relative flex flex-col border-t border-border bg-card text-foreground"
      style={{ height: terminalHeight }}
    >
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize terminal"
        title="Drag to resize terminal"
        onPointerDown={handleResizePointerDown}
        className="absolute inset-x-0 top-0 z-20 h-1 cursor-row-resize transition-colors hover:bg-primary/40"
      />
      {/* Terminal Header with High Contrast Design Tokens */}
      <div className="flex h-9 items-center justify-between border-b border-border bg-card px-3 text-xs">
        <div className="flex items-center gap-2.5">
          <SquareTerminal className="h-4 w-4 text-primary" />
          <span className="font-semibold text-foreground">Terminal</span>
          {shellInfo && (
            <span className="max-w-[240px] truncate text-xs text-muted-foreground font-mono" title={shellInfo}>
              ({shellInfo})
            </span>
          )}
          {isExited && (
            <span className="rounded bg-destructive/15 px-1.5 py-0.5 text-[11px] font-medium text-destructive">
              Exited
            </span>
          )}
          {terminalError && (
            <span className="flex items-center gap-1 text-xs text-destructive" title={terminalError}>
              <AlertCircle className="h-3.5 w-3.5" />
              Failed to start
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <select
            value={shellPreference}
            onChange={handleShellPreferenceChange}
            className="h-7 rounded border border-input bg-background px-2.5 py-1 text-xs font-medium text-foreground hover:bg-accent focus:outline-none focus:ring-1 focus:ring-ring"
            aria-label="Select terminal shell"
          >
            {TERMINAL_SHELL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <Button
            variant="ghost"
            size="icon"
            className="group h-7 w-7 text-muted-foreground hover:bg-accent hover:text-foreground"
            onClick={() => void handleCopyLast()}
            title="Copy last command + output"
            aria-label="Copy last command and output"
            disabled={!activeSessionId || !hasLastInteraction}
          >
            <span className="relative flex h-4 w-4 items-center justify-center">
              <Copy className="h-3.5 w-3.5" />
              <span className="absolute -bottom-0.5 -right-0.5 rounded-[1px] bg-card px-[2px] py-px text-[7px] font-black leading-none text-foreground/80 transition-colors group-hover:bg-accent group-hover:text-foreground">
                L
              </span>
            </span>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="group h-7 w-7 text-muted-foreground hover:bg-accent hover:text-foreground"
            onClick={() => void handleCopyAll()}
            title="Copy all terminal contents"
            aria-label="Copy all terminal contents"
            disabled={!activeSessionId}
          >
            <span className="relative flex h-4 w-4 items-center justify-center">
              <Copy className="h-3.5 w-3.5" />
              <span className="absolute -bottom-0.5 -right-0.5 rounded-[1px] bg-card px-[2px] py-px text-[7px] font-black leading-none text-foreground/80 transition-colors group-hover:bg-accent group-hover:text-foreground">
                A
              </span>
            </span>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-accent"
            onClick={handleRestart}
            title="Restart terminal"
            aria-label="Restart terminal"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-accent"
            onClick={onClose}
            title="Hide terminal (Ctrl+`)"
            aria-label="Hide terminal"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* xterm canvas */}
      <div className="relative min-h-0 flex-1 overflow-hidden bg-[#090d16] p-1">
        <div ref={terminalElementRef} className="h-full w-full" />
      </div>
    </div>
  );
}
