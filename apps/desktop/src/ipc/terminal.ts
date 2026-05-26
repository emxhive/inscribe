import { ipcMain, BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import { randomUUID } from 'crypto';
import fs from 'fs';
import type {
  TerminalCreateOptions,
  TerminalDataEvent,
  TerminalRunExitEvent,
  TerminalSessionExitEvent,
  TerminalSignalKind,
  TerminalSessionInfo,
  TerminalShellPreference,
} from '../types';
import { requireTrustedRepoRoot } from './trustedRepo';

type TerminalShellKind = 'powershell' | 'cmd' | 'posix';

interface TerminalProcess {
  write: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  kill: (signal?: NodeJS.Signals) => void;
}

interface TerminalSession {
  id: string;
  owner: Electron.WebContents;
  process: TerminalProcess;
  cwd: string;
  shell: string;
  shellKind: TerminalShellKind;
  activeRunId: string | null;
  lineBuffer: string;
  terminating: boolean;
}

type PtyModule = typeof import('node-pty');
type PtyProcess = ReturnType<PtyModule['spawn']>;
type ShellConfig = { file: string; args: string[]; kind: TerminalShellKind; preference: TerminalShellPreference };

const sessions = new Map<string, TerminalSession>();
const EXIT_PREFIX = '__INSCRIBE_EXIT:';
const CWD_PREFIX = '__INSCRIBE_CWD:';

let ptyModule: PtyModule | null | undefined;

function getPtyModule(): PtyModule | null {
  if (ptyModule !== undefined) return ptyModule;
  try {
    // Native Electron modules sometimes need a local rebuild. Falling back keeps
    // command execution usable while preserving the PTY path for full installs.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    ptyModule = require('node-pty') as PtyModule;
  } catch {
    ptyModule = null;
  }
  return ptyModule;
}

function inferShellKind(file: string): TerminalShellKind {
  const normalized = file.toLowerCase();
  if (normalized.endsWith('cmd.exe') || normalized === 'cmd') return 'cmd';
  if (normalized.includes('powershell') || normalized.endsWith('pwsh.exe') || normalized === 'pwsh') {
    return 'powershell';
  }
  return 'posix';
}

function windowsBashCandidates(): ShellConfig[] {
  const candidates = [
    'C:\\Program Files\\Git\\bin\\bash.exe',
    'C:\\Program Files\\Git\\usr\\bin\\bash.exe',
    'bash.exe',
  ];

  return candidates
    .filter((file, index) => index === candidates.length - 1 || fs.existsSync(file))
    .map((file) => ({
      file,
      args: ['--noprofile', '--norc', '-i'],
      kind: 'posix' as const,
      preference: 'bash' as const,
    }));
}

function powershellCandidate(): ShellConfig {
  return {
    file: 'powershell.exe',
    args: ['-NoLogo', '-NoProfile', '-ExecutionPolicy', 'Bypass'],
    kind: 'powershell',
    preference: 'powershell',
  };
}

function cmdCandidate(): ShellConfig {
  return {
    file: 'cmd.exe',
    args: [],
    kind: 'cmd',
    preference: 'cmd',
  };
}

function getShellCandidates(shellPreference: TerminalShellPreference = 'auto'): ShellConfig[] {
  if (process.platform === 'win32') {
    const configuredShell = process.env.INSCRIBE_TERMINAL_SHELL;
    if (configuredShell) {
      const kind = inferShellKind(configuredShell);
      return [{
        file: configuredShell,
        args: kind === 'powershell' ? ['-NoLogo', '-NoProfile', '-ExecutionPolicy', 'Bypass'] : [],
        kind,
        preference: shellPreference,
      }];
    }

    if (shellPreference === 'bash') return [...windowsBashCandidates(), powershellCandidate(), cmdCandidate()];
    if (shellPreference === 'powershell') return [powershellCandidate(), ...windowsBashCandidates(), cmdCandidate()];
    if (shellPreference === 'cmd') return [cmdCandidate(), ...windowsBashCandidates(), powershellCandidate()];
    return [...windowsBashCandidates(), powershellCandidate(), cmdCandidate()];
  }

  if (shellPreference === 'bash' || shellPreference === 'auto') {
    return [{
      file: process.env.SHELL || '/bin/bash',
      args: [],
      kind: 'posix',
      preference: shellPreference,
    }];
  }

  return [{
    file: process.env.SHELL || '/bin/bash',
    args: [],
    kind: 'posix',
    preference: shellPreference,
  }];
}

function createPtyProcess(
  shell: ShellConfig,
  options: TerminalCreateOptions,
  onData: (data: string) => void,
  onExit: (exitCode: number | null) => void,
): TerminalProcess {
  const pty = getPtyModule();
  if (!pty) {
    throw new Error('node-pty is not available');
  }

  const child: PtyProcess = pty.spawn(shell.file, shell.args, {
    name: 'xterm-256color',
    cols: options.cols,
    rows: options.rows,
    cwd: options.cwd,
    env: process.env,
  });

  child.onData(onData);
  child.onExit((event) => onExit(event.exitCode ?? null));

  return {
    write: (data) => child.write(data),
    resize: (cols, rows) => child.resize(cols, rows),
    kill: (signal) => child.kill(signal),
  };
}

function createFallbackProcess(
  shell: ShellConfig,
  options: TerminalCreateOptions,
  onData: (data: string) => void,
  onExit: (exitCode: number | null) => void,
): Promise<TerminalProcess> {
  const child: ChildProcessWithoutNullStreams = spawn(shell.file, shell.args, {
    cwd: options.cwd,
    env: process.env,
    shell: false,
    windowsHide: true,
  });

  return new Promise((resolve, reject) => {
    let settled = false;
    const settle = (processHandle: TerminalProcess) => {
      if (settled) return;
      settled = true;
      resolve(processHandle);
    };

    child.once('spawn', () => {
      child.stdout.on('data', (data: Buffer) => onData(data.toString()));
      child.stderr.on('data', (data: Buffer) => onData(data.toString()));
      child.on('exit', (code) => onExit(code));

      settle({
        write: (data) => child.stdin.write(data),
        resize: () => undefined,
        kill: (signal) => child.kill(signal),
      });
    });

    child.once('error', (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    });
  });
}

function sendToOwner<T extends TerminalDataEvent | TerminalRunExitEvent>(
  session: TerminalSession,
  channel: T extends TerminalDataEvent ? 'terminal:data' : 'terminal:run-exit',
  payload: T,
) {
  if (session.owner.isDestroyed()) return;
  session.owner.send(channel, payload);
}

function sendSessionExit(session: TerminalSession, payload: TerminalSessionExitEvent) {
  if (session.owner.isDestroyed()) return;
  session.owner.send('terminal:session-exit', payload);
}

function stripAnsi(text: string): string {
  return text.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, '');
}

function isInternalPlainLine(plainLine: string): boolean {
  return (
    plainLine.includes(EXIT_PREFIX) ||
    plainLine.includes(CWD_PREFIX) ||
    plainLine.includes('$__inscribeExit') ||
    plainLine.includes('__inscribe_exit') ||
    plainLine.includes('INSCRIBE_EXIT=')
  );
}

function isPotentialInternalLine(rawText: string): boolean {
  const plainText = stripAnsi(rawText).trimStart();
  if (!plainText) return true;
  const internalPrefixes = [
    EXIT_PREFIX,
    CWD_PREFIX,
    '$__inscribeExit',
    '__inscribe_exit',
    'INSCRIBE_EXIT=',
  ];
  return (
    internalPrefixes.some((prefix) => plainText.startsWith(prefix) || prefix.startsWith(plainText))
  );
}

function sendRunExit(
  session: TerminalSession,
  exitCode: number | null,
  reason: TerminalRunExitEvent['reason'] = 'exited',
) {
  if (!session.activeRunId) return;
  sendToOwner(session, 'terminal:run-exit', {
    sessionId: session.id,
    runId: session.activeRunId,
    exitCode,
    cwd: session.cwd,
    reason,
  });
  session.activeRunId = null;
}

function handleCompleteLine(session: TerminalSession, rawLine: string) {
  const plainLine = stripAnsi(rawLine).trim();
  const exitPrefix = `${EXIT_PREFIX}${session.activeRunId ?? ''}:`;
  const cwdPrefix = `${CWD_PREFIX}${session.activeRunId ?? ''}:`;

  if (session.activeRunId && plainLine.startsWith(exitPrefix)) {
    const match = plainLine.match(new RegExp(`${EXIT_PREFIX}${session.activeRunId}:(-?\\d+)`));
    if (match) {
      sendRunExit(session, Number(match[1]), 'exited');
    }
    return;
  }

  if (session.activeRunId && plainLine.startsWith(cwdPrefix)) {
    const cwd = plainLine.slice(cwdPrefix.length).trim();
    if (cwd) session.cwd = cwd;
    return;
  }

  if (isInternalPlainLine(plainLine)) {
    return;
  }

  sendToOwner(session, 'terminal:data', {
    sessionId: session.id,
    runId: session.activeRunId,
    data: rawLine,
  });
}

function handleProcessData(session: TerminalSession, data: string) {
  session.lineBuffer += data.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  let newlineIndex = session.lineBuffer.indexOf('\n');
  while (newlineIndex >= 0) {
    const line = `${session.lineBuffer.slice(0, newlineIndex)}\r\n`;
    session.lineBuffer = session.lineBuffer.slice(newlineIndex + 1);
    handleCompleteLine(session, line);
    newlineIndex = session.lineBuffer.indexOf('\n');
  }

  if (session.lineBuffer && !isPotentialInternalLine(session.lineBuffer)) {
    sendToOwner(session, 'terminal:data', {
      sessionId: session.id,
      runId: session.activeRunId,
      data: session.lineBuffer,
    });
    session.lineBuffer = '';
  }
}

function buildSentinelCommand(session: TerminalSession, runId: string): string {
  switch (session.shellKind) {
    case 'powershell':
      return `$__inscribeExit = if ($global:LASTEXITCODE -is [int]) { $global:LASTEXITCODE } elseif ($?) { 0 } else { 1 }; Write-Output "${CWD_PREFIX}${runId}:$(Get-Location)"; Write-Output "${EXIT_PREFIX}${runId}:$__inscribeExit"`;
    case 'cmd':
      return `set INSCRIBE_EXIT=%ERRORLEVEL% && echo ${CWD_PREFIX}${runId}:%CD% && echo ${EXIT_PREFIX}${runId}:%INSCRIBE_EXIT%`;
    case 'posix':
    default:
      return `__inscribe_exit=$?; printf '\\n${CWD_PREFIX}${runId}:%s\\n' "$PWD"; printf '${EXIT_PREFIX}${runId}:%s\\n' "$__inscribe_exit"`;
  }
}

function writeLine(session: TerminalSession, line: string) {
  session.process.write(`${line}${process.platform === 'win32' ? '\r' : '\n'}`);
}

function handleProcessExit(sessionId: string, exitCode: number | null) {
  const session = sessions.get(sessionId);
  if (!session) return;
  sessions.delete(sessionId);
  sendRunExit(session, exitCode, session.terminating ? 'terminated' : 'session-exit');
  sendSessionExit(session, {
    sessionId: session.id,
    exitCode,
    reason: session.terminating ? 'terminated' : 'exited',
  });
}

function disposeSession(sessionId: string, reason: TerminalSessionExitEvent['reason'] = 'disposed') {
  const session = sessions.get(sessionId);
  if (!session) return false;
  sessions.delete(sessionId);
  sendRunExit(session, null, reason);
  sendSessionExit(session, {
    sessionId: session.id,
    exitCode: null,
    reason,
  });
  try {
    session.process.kill();
  } catch {
    // The process may already be gone.
  }
  return true;
}

function getOwnedSession(event: IpcMainInvokeEvent, sessionId: string): TerminalSession | null {
  const session = sessions.get(sessionId);
  if (!session) return null;
  if (session.owner !== event.sender) return null;
  return session;
}

export function registerTerminalHandlers() {
  ipcMain.handle('terminal-create', async (event, options: TerminalCreateOptions): Promise<TerminalSessionInfo> => {
    const cwd = requireTrustedRepoRoot(event, options.cwd);
    const shellCandidates = getShellCandidates(options.shellPreference);
    const id = randomUUID();
    const webContents = event.sender;
    const onExit = (exitCode: number | null) => handleProcessExit(id, exitCode);

    let session: TerminalSession | null = null;
    const pendingData: string[] = [];
    const onData = (data: string) => {
      if (session) {
        handleProcessData(session, data);
        return;
      }
      pendingData.push(data);
    };
    let processHandle: TerminalProcess | null = null;
    let selectedShell: ShellConfig | null = null;
    const startupErrors: string[] = [];

    for (const shell of shellCandidates) {
      try {
        processHandle = createPtyProcess(shell, { ...options, cwd }, onData, onExit);
        selectedShell = shell;
        break;
      } catch (error) {
        startupErrors.push(`${shell.file} PTY: ${error instanceof Error ? error.message : String(error)}`);
      }

      try {
        processHandle = await createFallbackProcess(shell, { ...options, cwd }, onData, onExit);
        selectedShell = shell;
        break;
      } catch (error) {
        startupErrors.push(`${shell.file} fallback: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    if (!processHandle || !selectedShell) {
      throw new Error(`Unable to start terminal shell. ${startupErrors.join(' | ')}`);
    }

    session = {
      id,
      owner: webContents,
      process: processHandle,
      cwd,
      shell: selectedShell.file,
      shellKind: selectedShell.kind,
      activeRunId: null,
      lineBuffer: '',
      terminating: false,
    };

    sessions.set(id, session);
    pendingData.forEach((data) => handleProcessData(session as TerminalSession, data));

    const ownerWindow = BrowserWindow.fromWebContents(webContents);
    ownerWindow?.once('closed', () => disposeSession(id));

    return {
      sessionId: id,
      cwd,
      shell: selectedShell.file,
      shellPreference: selectedShell.preference,
    };
  });

  ipcMain.handle('terminal-run-command', (event, sessionId: string, runId: string, command: string) => {
    const session = getOwnedSession(event, sessionId);
    if (!session) return false;
    if (session.activeRunId) return false;

    session.activeRunId = runId;
    writeLine(session, command);
    writeLine(session, buildSentinelCommand(session, runId));
    return true;
  });

  ipcMain.handle('terminal-write', (event, sessionId: string, data: string) => {
    const session = getOwnedSession(event, sessionId);
    if (!session) return false;
    if (!session.activeRunId) return false;
    session.process.write(data);
    return true;
  });

  ipcMain.handle('terminal-resize', (event, sessionId: string, cols: number, rows: number) => {
    const session = getOwnedSession(event, sessionId);
    if (!session) return false;
    session.process.resize(cols, rows);
    return true;
  });

  ipcMain.handle('terminal-signal', (event, sessionId: string, kind: TerminalSignalKind) => {
    const session = getOwnedSession(event, sessionId);
    if (!session) return false;
    if (kind === 'interrupt') {
      session.process.write('\x03');
      return true;
    }
    if (kind === 'eof') {
      session.process.write(session.shellKind === 'posix' ? '\x04' : '\x1a\r');
      return true;
    }
    if (kind === 'terminate') {
      session.terminating = true;
      try {
        session.process.kill('SIGTERM');
      } catch {
        disposeSession(sessionId, 'terminated');
      }
      return true;
    }
    return false;
  });

  ipcMain.handle('terminal-interrupt', (event, sessionId: string) => {
    const session = getOwnedSession(event, sessionId);
    if (!session) return false;
    session.process.write('\x03');
    return true;
  });

  ipcMain.handle('terminal-dispose', (event, sessionId: string) => {
    const session = getOwnedSession(event, sessionId);
    if (!session) return false;
    return disposeSession(sessionId);
  });
}
