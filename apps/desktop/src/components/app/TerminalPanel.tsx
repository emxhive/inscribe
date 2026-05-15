import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import { AlertTriangle, Check, Copy, Play, Square, SquareTerminal } from 'lucide-react';
import type { CliCommandSuggestion } from '@inscribe/shared';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { TerminalDataEvent, TerminalRunExitEvent } from '@/types';

type TerminalRunStatus = 'running' | 'success' | 'failed' | 'unknown';

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
  onClose: () => void;
}

const ANSI_PATTERN = /\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g;

function stripAnsi(text: string): string {
  return text.replace(ANSI_PATTERN, '');
}

function createRunId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `run-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function formatRunForClipboard(run: TerminalRun): string {
  const output = stripAnsi(run.output).trimEnd();
  const exitLine = run.exitCode !== null && run.exitCode !== 0 ? `\n\n[exit code: ${run.exitCode}]` : '';
  return [`$ ${run.command}`, output].filter(Boolean).join('\n\n') + exitLine;
}

function findSuggestionForCommand(
  command: string,
  suggestions: CliCommandSuggestion[],
): CliCommandSuggestion | null {
  return suggestions.find((suggestion) => suggestion.command === command) ?? null;
}

export function TerminalPanel({ repoRoot, suggestions, onClose }: TerminalPanelProps) {
  const terminalElementRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [shell, setShell] = useState<string>('');
  const [cwd, setCwd] = useState(repoRoot ?? '');
  const [commandInput, setCommandInput] = useState('');
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [runs, setRuns] = useState<TerminalRun[]>([]);
  const [copiedRunId, setCopiedRunId] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const activeSuggestion = suggestions[suggestionIndex] ?? null;
  const ghostSuggestion = commandInput.length === 0 ? activeSuggestion?.command ?? '' : '';
  const hasRepo = Boolean(repoRoot);

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

    const terminal = new Terminal({
      allowProposedApi: false,
      convertEol: true,
      cursorBlink: true,
      disableStdin: true,
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
    void window.inscribeAPI.terminalCreate({
      cwd: repoRoot,
      cols: terminal.cols || 80,
      rows: terminal.rows || 24,
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
    });

    return () => {
      disposed = true;
      resizeObserver.disconnect();
      if (sessionIdRef.current) {
        void window.inscribeAPI.terminalDispose(sessionIdRef.current);
      }
      sessionIdRef.current = null;
      setSessionId(null);
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, [repoRoot]);

  useEffect(() => {
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
      setRuns((currentRuns) =>
        currentRuns.map((run) => {
          if (run.id !== event.runId) return run;
          const status: TerminalRunStatus =
            event.exitCode === 0 ? 'success' : event.exitCode === null ? 'unknown' : 'failed';
          return { ...run, exitCode: event.exitCode, status };
        }),
      );
    });

    return () => {
      removeDataListener();
      removeExitListener();
    };
  }, []);

  const acceptSuggestion = () => {
    if (!activeSuggestion) return;
    setCommandInput(activeSuggestion.command);
  };

  const runCommand = async () => {
    const command = commandInput.trim();
    if (!command || !sessionId || isRunning) return;
    const suggestion = findSuggestionForCommand(command, suggestions);
    if (suggestion?.risk === 'destructive') {
      const confirmed = window.confirm(`Run destructive command?\n\n${command}`);
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
    setCommandInput('');
    const accepted = await window.inscribeAPI.terminalRunCommand(sessionId, runId, command);
    if (!accepted) {
      setIsRunning(false);
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
    await window.inscribeAPI.terminalInterrupt(sessionId);
  };

  return (
    <section className="flex h-80 min-h-[14rem] flex-shrink-0 flex-col border-t border-border bg-[#0f172a] text-slate-100">
      <div className="flex h-10 items-center gap-2 border-b border-slate-700/80 bg-slate-950 px-3">
        <SquareTerminal className="h-4 w-4 text-sky-300" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-semibold text-slate-100">{cwd || 'Terminal'}</div>
          <div className="truncate text-[10px] text-slate-400">{shell || 'Starting shell...'}</div>
        </div>
        {suggestions.length > 0 && (
          <span className="rounded border border-slate-700 px-1.5 py-0.5 text-[10px] font-semibold text-slate-300">
            {suggestionIndex + 1}/{suggestions.length}
          </span>
        )}
        <Button
          variant="ghost"
          size="icon"
          type="button"
          className="h-7 w-7 text-slate-300 hover:bg-slate-800 hover:text-white"
          disabled={!isRunning}
          onClick={interrupt}
          title="Stop command"
          aria-label="Stop command"
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
                  value={commandInput}
                  disabled={!hasRepo || !sessionId || isRunning}
                  onChange={(event) => setCommandInput(event.target.value)}
                  onKeyDown={handleCommandKeyDown}
                  className="relative z-10 h-8 w-full bg-transparent font-mono text-xs text-slate-100 caret-sky-300 outline-none placeholder:text-slate-500 disabled:cursor-not-allowed disabled:text-slate-500"
                  placeholder={hasRepo ? '' : 'Select a repository first'}
                  spellCheck={false}
                />
              </div>
              {activeSuggestion?.risk !== 'normal' && commandInput.length === 0 && (
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
                disabled={!commandInput.trim() || !sessionId || isRunning}
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
