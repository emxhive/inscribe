import React, { useEffect, useRef, useState } from 'react';
import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import { AlertCircle, RotateCcw, SquareTerminal, X } from 'lucide-react';
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

  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [shellInfo, setShellInfo] = useState<string>('');
  const [shellPreference, setShellPreference] = useState<TerminalShellPreference>(getInitialShellPreference);
  const [terminalError, setTerminalError] = useState<string | null>(null);
  const [isExited, setIsExited] = useState(false);
  const [restartCounter, setRestartCounter] = useState(0);

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

    // Direct raw input forwarding to PTY
    const dataDisposable = terminal.onData((data) => {
      const currentSessionId = sessionIdRef.current;
      if (!currentSessionId) return;
      void window.inscribeAPI.terminalWrite(currentSessionId, data);
    });

    // Keyboard-only suggestion traversal: Alt+Up / Alt+Down replacing current prompt input
    terminal.attachCustomKeyEventHandler((event: KeyboardEvent) => {
      if (event.type === 'keydown' && event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
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

    requestAnimationFrame(fitAndResize);
    const resizeObserver = new ResizeObserver(fitAndResize);
    resizeObserver.observe(container);

    let isDisposed = false;

    // Create PTY session via IPC
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

    // Listen to incoming raw PTY data and exit events
    const removeDataListener = window.inscribeAPI.onTerminalData((event: TerminalDataEvent) => {
      if (event.sessionId !== sessionIdRef.current) return;
      terminal.write(event.data);
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

  // When visibility changes to open, re-fit and focus xterm
  useEffect(() => {
    if (isOpen && terminalRef.current && fitAddonRef.current) {
      requestAnimationFrame(() => {
        try {
          fitAddonRef.current?.fit();
          const terminal = terminalRef.current;
          if (terminal && sessionIdRef.current) {
            void window.inscribeAPI.terminalResize(sessionIdRef.current, terminal.cols, terminal.rows);
          }
          terminal?.focus();
        } catch {
          // Ignored
        }
      });
    }
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

  return (
    <div className="flex h-64 flex-col border-t border-border bg-card text-foreground">
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
