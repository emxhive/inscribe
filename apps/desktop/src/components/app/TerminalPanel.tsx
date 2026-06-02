import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import { AlertTriangle, Check, Copy, Play, Square, SquareTerminal } from 'lucide-react';
import { classifyCommandRisk, type CliCommandSuggestion } from '@inscribe/shared';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { TerminalDataEvent, TerminalRunExitEvent, TerminalSessionExitEvent, TerminalShellPreference } from '@/types';

type TerminalRunStatus = 'running' | 'success' | 'failed' | 'interrupted' | 'terminated' | 'unknown';

interface TerminalRun {
  id: string;
  command: string;
  output: string;
  startedAt: number;
  exitCode: number | null;
  status: TerminalRunStatus;
}

interface TerminalPanelProps {
  repoRoot: string | null;
  suggestions: CliCommandSuggestion[];
  commandHistory: string[];
  onCommandRun: (command: string) => void;
  onClose: () => void;
}

const ANSI_PATTERN = /\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g;
const CONTROL_PATTERN = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;
const TERMINAL_SHELL_STORAGE_KEY = 'inscribe:terminal:shellPreference';
const TERMINAL_SHELL_OPTIONS: Array<{ value: TerminalShellPreference; label: string }> = [
  { value: 'bash', label: 'Bash' },
  { value: 'auto', label: 'Auto' },
  { value: 'powershell', label: 'PowerShell' },
  { value: 'cmd', label: 'cmd' },
];

function stripAnsi(text: string): string {
  return text.replace(ANSI_PATTERN, '');
}

function getInitialShellPreference(): TerminalShellPreference {
  if (typeof window === 'undefined') return 'bash';
  const stored = window.localStorage.getItem(TERMINAL_SHELL_STORAGE_KEY);
  if (stored === 'auto' || stored === 'bash' || stored === 'powershell' || stored === 'cmd') {
    return stored;
  }
  return 'bash';
}

function sanitizeTerminalOutputForClipboard(text: string, command: string): string {
  const withoutAnsi = stripAnsi(text);
  const lines = withoutAnsi
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => {
      let cleaned = line;
      while (/[^\b]\x08/.test(cleaned)) {
        cleaned = cleaned.replace(/[^\b]\x08/g, '');
      }
      return cleaned.replace(CONTROL_PATTERN, '').trimEnd();
    })
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return false;
      if (trimmed.includes('__INSCRIBE_EXIT:') || trimmed.includes('__INSCRIBE_CWD:')) return false;
      if (trimmed.includes('$__inscribeExit') || trimmed.includes('__inscribe_exit')) return false;
      if (trimmed.includes('INSCRIBE_EXIT=')) return false;
      if (trimmed.includes('Cannot load PSReadline module.')) return false;
      if (trimmed === command || trimmed.endsWith(command)) return false;
      return !/^[\\|/-]+$/.test(trimmed);
    });

  return lines.join('\n').trimEnd();
}

function createRunId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `run-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function formatRunForClipboard(run: TerminalRun): string {
  const output = sanitizeTerminalOutputForClipboard(run.output, run.command);
  const exitLine = run.exitCode !== null && run.exitCode !== 0 ? `\n\n[exit code: ${run.exitCode}]` : '';
  return [`$ ${run.command}`, output].filter(Boolean).join('\n\n') + exitLine;
}

export function TerminalPanel({ repoRoot, suggestions, commandHistory, onCommandRun, onClose }: TerminalPanelProps) {
  const terminalElementRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const isRunningRef = useRef(false);
  const stopRequestedRef = useRef(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [shell, setShell] = useState<string>('');
  const [cwd, setCwd] = useState(repoRoot ?? '');
  const [commandInput, setCommandInput] = useState('');
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const [runs, setRuns] = useState<TerminalRun[]>([]);
  const [copiedRunId, setCopiedRunId] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [stopRequested, setStopRequested] = useState(false);
  const [restartNonce, setRestartNonce] = useState(0);
  const [terminalError, setTerminalError] = useState<string | null>(null);
  const [shellPreference, setShellPreference] = useState<TerminalShellPreference>(getInitialShellPreference);
  const activeSuggestion = suggestions[suggestionIndex] ?? null;
  const ghostSuggestion = commandInput.length === 0 ? activeSuggestion?.command ?? '' : '';
  const hasRepo = Boolean(repoRoot);
  const terminalApiAvailable =
    typeof window.inscribeAPI.terminalCreate === 'function' &&
    typeof window.inscribeAPI.terminalWrite === 'function' &&
    typeof window.inscribeAPI.terminalSignal === 'function' &&
    typeof window.inscribeAPI.onTerminalSessionExit === 'function';

  const sortedRuns = useMemo(
    () => [...runs].sort((a, b) => b.startedAt - a.startedAt),
    [runs],
  );

  useEffect(() => {
    setSuggestionIndex(0);
  }, [suggestions]);

  useEffect(() => {
    const container = terminalElementRef.current;
    if (!container || !repoRoot) return;
    setTerminalError(null);

    const terminal = new Terminal({
      allowProposedApi: false,
      convertEol: true,
      cursorBlink: true,
      disableStdin: false,
      fontFamily: 'JetBrains Mono, ui-monospace, SFMono-Regular, Consolas, monospace',
      fontSize: 12,
      lineHeight: 1.35,
      scrollback: 8000,
      theme: {
        background: '#0f172a',
        foreground: '#dbeafe',
        cursor: '#93c5fd',
        selectionBackground: '#334155',
      },
    });
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(container);
    terminal.writeln('Inscribe terminal');
    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;
    const dataDisposable = terminal.onData((data) => {
      const currentSessionId = sessionIdRef.current;
      if (!currentSessionId || !isRunningRef.current) return;
      void window.inscribeAPI.terminalWrite(currentSessionId, data);
    });

    const fitAndResize = () => {
      try {
        fitAddon.fit();
        const dimensions = { cols: terminal.cols, rows: terminal.rows };
        const currentSessionId = sessionIdRef.current;
        if (currentSessionId) {
          void window.inscribeAPI.terminalResize(currentSessionId, dimensions.cols, dimensions.rows);
        }
      } catch {
        // The terminal may not have measurable dimensions during mount/unmount.
      }
    };

    requestAnimationFrame(fitAndResize);
    const resizeObserver = new ResizeObserver(fitAndResize);
    resizeObserver.observe(container);

    let disposed = false;
    if (!terminalApiAvailable) {
      const message = 'Terminal IPC is unavailable. Restart Inscribe so the updated main process and preload are loaded.';
      setTerminalError(message);
      setShell('Terminal unavailable');
      terminal.writeln(`Error: ${message}`);
      return () => {
        disposed = true;
        resizeObserver.disconnect();
        dataDisposable.dispose();
        terminal.dispose();
        terminalRef.current = null;
        fitAddonRef.current = null;
      };
    }

    void window.inscribeAPI.terminalCreate({
      cwd: repoRoot,
      cols: terminal.cols || 80,
      rows: terminal.rows || 24,
      shellPreference,
    }).then((info) => {
      if (disposed) {
        void window.inscribeAPI.terminalDispose(info.sessionId);
        return;
      }
      sessionIdRef.current = info.sessionId;
      setSessionId(info.sessionId);
      setShell(info.shell);
      setCwd(info.cwd);
      terminal.writeln(`Shell: ${info.shell}`);
      terminal.writeln(`CWD: ${info.cwd}`);
      fitAndResize();
      requestAnimationFrame(() => inputRef.current?.focus());
    }).catch((error) => {
      if (disposed) return;
      const message = error instanceof Error ? error.message : String(error);
      setTerminalError(message);
      setShell('Terminal failed to start');
      terminal.writeln(`Error: ${message}`);
    });

    return () => {
      disposed = true;
      resizeObserver.disconnect();
      if (sessionIdRef.current) {
        void window.inscribeAPI.terminalDispose(sessionIdRef.current);
      }
      sessionIdRef.current = null;
      setSessionId(null);
      isRunningRef.current = false;
      dataDisposable.dispose();
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, [repoRoot, restartNonce, shellPreference, terminalApiAvailable]);

  const handleShellPreferenceChange = (nextPreference: TerminalShellPreference) => {
    setShellPreference(nextPreference);
    window.localStorage.setItem(TERMINAL_SHELL_STORAGE_KEY, nextPreference);
  };

  useEffect(() => {
    if (!terminalApiAvailable) return;
    const removeDataListener = window.inscribeAPI.onTerminalData((event: TerminalDataEvent) => {
      if (event.sessionId !== sessionIdRef.current) return;
      terminalRef.current?.write(event.data);
      if (!event.runId) return;
      setRuns((currentRuns) =>
        currentRuns.map((run) =>
          run.id === event.runId ? { ...run, output: `${run.output}${event.data}` } : run,
        ),
      );
    });

    const removeExitListener = window.inscribeAPI.onTerminalRunExit((event: TerminalRunExitEvent) => {
      if (event.sessionId !== sessionIdRef.current) return;
      if (event.cwd) {
        setCwd(event.cwd);
      }
      setIsRunning(false);
      isRunningRef.current = false;
      setStopRequested(false);
      const wasStopRequested = stopRequestedRef.current;
      stopRequestedRef.current = false;
      requestAnimationFrame(() => inputRef.current?.focus());
      setRuns((currentRuns) =>
        currentRuns.map((run) => {
          if (run.id !== event.runId) return run;
          let status: TerminalRunStatus = event.exitCode === 0 ? 'success' : event.exitCode === null ? 'unknown' : 'failed';
          if (event.reason === 'terminated') status = 'terminated';
          if (event.reason === 'interrupted') status = 'interrupted';
          if (event.reason === 'session-exit' || event.reason === 'disposed') status = 'unknown';
          if (wasStopRequested && status === 'failed') status = 'interrupted';
          return { ...run, exitCode: event.exitCode, status };
        }),
      );
    });

    const removeSessionExitListener = window.inscribeAPI.onTerminalSessionExit((event: TerminalSessionExitEvent) => {
      if (event.sessionId !== sessionIdRef.current) return;
      sessionIdRef.current = null;
      setSessionId(null);
      setIsRunning(false);
      isRunningRef.current = false;
      setStopRequested(false);
      stopRequestedRef.current = false;
      terminalRef.current?.writeln('');
      terminalRef.current?.writeln(`[terminal ${event.reason}]`);
      if (event.reason === 'terminated') {
        window.setTimeout(() => setRestartNonce((nonce) => nonce + 1), 250);
      }
    });

    return () => {
      removeDataListener();
      removeExitListener();
      removeSessionExitListener();
    };
  }, [terminalApiAvailable]);

  const acceptSuggestion = () => {
    if (!activeSuggestion) return;
    setCommandInput(activeSuggestion.command);
    setHistoryIndex(null);
  };

  const recallHistory = (direction: -1 | 1) => {
    if (commandHistory.length === 0) return;
    setHistoryIndex((currentIndex) => {
      const latestIndex = commandHistory.length - 1;
      const nextIndex =
        currentIndex === null
          ? latestIndex
          : Math.min(latestIndex, Math.max(0, currentIndex + direction));
      setCommandInput(commandHistory[nextIndex] ?? '');
      return nextIndex;
    });
  };

  const runCommand = async () => {
    const command = commandInput.trim();
    if (!command || !sessionId || isRunning || terminalError) return;
    const risk = classifyCommandRisk(command);
    if (risk !== 'normal') {
      const confirmed = window.confirm(`Run ${risk} command?\n\n${command}`);
      if (!confirmed) return;
    }

    const runId = createRunId();
    setRuns((currentRuns) => [
      {
        id: runId,
        command,
        output: '',
        startedAt: Date.now(),
        exitCode: null,
        status: 'running',
      },
      ...currentRuns,
    ]);
    setIsRunning(true);
    isRunningRef.current = true;
    setStopRequested(false);
    stopRequestedRef.current = false;
    setCommandInput('');
    setHistoryIndex(null);
    terminalRef.current?.focus();
    let accepted = false;
    try {
      accepted = await window.inscribeAPI.terminalRunCommand(sessionId, runId, command);
    } catch (error) {
      setTerminalError(error instanceof Error ? error.message : String(error));
    }
    if (accepted) {
      onCommandRun(command);
    }
    if (!accepted) {
      setIsRunning(false);
      isRunningRef.current = false;
      setStopRequested(false);
      stopRequestedRef.current = false;
      setRuns((currentRuns) =>
        currentRuns.map((run) =>
          run.id === runId
            ? { ...run, output: 'Unable to run command in this terminal session.', status: 'failed', exitCode: null }
            : run,
        ),
      );
    }
  };

  const handleCommandKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.shiftKey && event.key === 'ArrowUp') {
      event.preventDefault();
      recallHistory(-1);
      return;
    }

    if (event.shiftKey && event.key === 'ArrowDown') {
      event.preventDefault();
      recallHistory(1);
      return;
    }

    if ((event.key === 'ArrowRight' || event.key === 'Tab') && ghostSuggestion) {
      event.preventDefault();
      acceptSuggestion();
      return;
    }

    if (event.key === 'ArrowDown' && suggestions.length > 0) {
      event.preventDefault();
      setSuggestionIndex((index) => (index + 1) % suggestions.length);
      return;
    }

    if (event.key === 'ArrowUp' && suggestions.length > 0) {
      event.preventDefault();
      setSuggestionIndex((index) => (index - 1 + suggestions.length) % suggestions.length);
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      void runCommand();
    }
  };

  const copyRun = async (run: TerminalRun) => {
    await navigator.clipboard.writeText(formatRunForClipboard(run));
    setCopiedRunId(run.id);
    window.setTimeout(() => setCopiedRunId((current) => (current === run.id ? null : current)), 1200);
  };

  const interrupt = async () => {
    if (!sessionId) return;
    if (stopRequested) {
      await window.inscribeAPI.terminalSignal(sessionId, 'terminate');
      return;
    }
    await window.inscribeAPI.terminalSignal(sessionId, 'interrupt');
    setStopRequested(true);
    stopRequestedRef.current = true;
  };

  return (
    <section className="flex h-80 min-h-[14rem] flex-shrink-0 flex-col border-t border-border bg-[#0f172a] text-slate-100">
      <div className="flex h-10 items-center gap-2 border-b border-slate-700/80 bg-slate-950 px-3">
        <SquareTerminal className="h-4 w-4 text-sky-300" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-semibold text-slate-100">{cwd || 'Terminal'}</div>
          <div className={cn('truncate text-[10px]', terminalError ? 'text-red-300' : 'text-slate-400')}>
            {terminalError ?? (shell || 'Starting shell...')}
          </div>
        </div>
        {suggestions.length > 0 && (
          <span className="rounded border border-slate-700 px-1.5 py-0.5 text-[10px] font-semibold text-slate-300">
            {suggestionIndex + 1}/{suggestions.length}
          </span>
        )}
        <select
          value={shellPreference}
          disabled={isRunning}
          onChange={(event) => handleShellPreferenceChange(event.target.value as TerminalShellPreference)}
          className="h-7 rounded-md border border-slate-700 bg-slate-900 px-2 text-[11px] font-semibold text-slate-200 outline-none hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          title="Terminal shell"
          aria-label="Terminal shell"
        >
          {TERMINAL_SHELL_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <Button
          variant="ghost"
          size="icon"
          type="button"
          className="h-7 w-7 text-slate-300 hover:bg-slate-800 hover:text-white"
          disabled={!isRunning}
          onClick={interrupt}
          title={stopRequested ? 'Terminate terminal session' : 'Stop command'}
          aria-label={stopRequested ? 'Terminate terminal session' : 'Stop command'}
        >
          <Square className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          type="button"
          className="h-7 w-7 text-slate-300 hover:bg-slate-800 hover:text-white"
          onClick={onClose}
          title="Close terminal"
          aria-label="Close terminal"
        >
          <SquareTerminal className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(11rem,16rem)_minmax(0,1fr)]">
        <aside className="min-h-0 overflow-y-auto border-r border-slate-700/80 bg-slate-950/80">
          {sortedRuns.length === 0 ? (
            <div className="p-3 text-xs text-slate-500">No commands run yet.</div>
          ) : (
            <div className="space-y-1 p-2">
              {sortedRuns.map((run) => (
                <div
                  key={run.id}
                  className="rounded-md border border-slate-800 bg-slate-900/80 p-2"
                >
                  <div className="mb-1 flex items-start gap-1.5">
                    <span
                      className={cn(
                        'mt-1 h-2 w-2 flex-shrink-0 rounded-full',
                        run.status === 'running' && 'bg-sky-400',
                        run.status === 'success' && 'bg-emerald-400',
                        run.status === 'failed' && 'bg-red-400',
                        run.status === 'interrupted' && 'bg-amber-300',
                        run.status === 'terminated' && 'bg-red-300',
                        run.status === 'unknown' && 'bg-slate-400',
                      )}
                    />
                    <p className="min-w-0 flex-1 truncate font-mono text-[11px] text-slate-200" title={run.command}>
                      {run.command}
                    </p>
                    <button
                      type="button"
                      className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded text-slate-400 hover:bg-slate-800 hover:text-white"
                      onClick={() => void copyRun(run)}
                      title="Copy command and output"
                      aria-label="Copy command and output"
                    >
                      {copiedRunId === run.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                  {run.exitCode !== null && run.exitCode !== 0 && (
                    <div className="text-[10px] font-semibold text-red-300">exit {run.exitCode}</div>
                  )}
                  {run.status === 'terminated' && (
                    <div className="text-[10px] font-semibold text-red-300">terminated</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </aside>

        <div className="flex min-h-0 flex-col">
          <div ref={terminalElementRef} className="min-h-0 flex-1 overflow-hidden p-2" />
          <div className="border-t border-slate-700/80 bg-slate-950 p-2">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-sky-300">$</span>
              <div className="relative min-w-0 flex-1">
                {ghostSuggestion && (
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center truncate font-mono text-xs text-slate-500">
                    {ghostSuggestion}
                  </div>
                )}
                <input
                  ref={inputRef}
                  value={commandInput}
                  disabled={!hasRepo || !sessionId || isRunning || Boolean(terminalError)}
                  onChange={(event) => {
                    setCommandInput(event.target.value);
                    setHistoryIndex(null);
                  }}
                  onKeyDown={handleCommandKeyDown}
                  className="relative z-10 h-8 w-full bg-transparent font-mono text-xs text-slate-100 caret-sky-300 outline-none placeholder:text-slate-500 disabled:cursor-not-allowed disabled:text-slate-500"
                  placeholder={terminalError ? 'Terminal unavailable' : isRunning ? 'Type replies in the terminal' : hasRepo ? '' : 'Select a repository first'}
                  spellCheck={false}
                />
              </div>
              {activeSuggestion && activeSuggestion.risk !== 'normal' && commandInput.length === 0 && (
                <AlertTriangle
                  className={cn(
                    'h-4 w-4',
                    activeSuggestion?.risk === 'destructive' ? 'text-red-300' : 'text-amber-300',
                  )}
                />
              )}
              <Button
                size="icon"
                type="button"
                className="h-8 w-8"
                disabled={!commandInput.trim() || !sessionId || isRunning || Boolean(terminalError)}
                onClick={() => void runCommand()}
                title="Run command"
                aria-label="Run command"
              >
                <Play className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
