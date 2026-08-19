import { ipcMain, BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import { randomUUID } from 'crypto';
import fs from 'fs';
import type {
  TerminalCreateOptions,
  TerminalDataEvent,
  TerminalSessionExitEvent,
  TerminalSessionInfo,
  TerminalShellPreference,
} from '../types';
import { requireTrustedRepoRoot } from './trustedRepo';

export type TerminalShellKind = 'powershell' | 'cmd' | 'posix';

type PtyModule = typeof import('node-pty');
type PtyProcess = ReturnType<PtyModule['spawn']>;

export interface ShellConfig {
  file: string;
  args: string[];
  kind: TerminalShellKind;
  preference: TerminalShellPreference;
}

export interface TerminalSession {
  id: string;
  owner: Electron.WebContents;
  pty: PtyProcess;
  cwd: string;
  shell: string;
  shellPreference: TerminalShellPreference;
}

export { buildTerminalLineReplacement } from '../utils/terminalLineReplacement';

export const sessions = new Map<string, TerminalSession>();

let ptyModule: PtyModule | null | undefined;

export function getPtyModule(): PtyModule | null {
  if (ptyModule !== undefined) return ptyModule;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    ptyModule = require('node-pty') as PtyModule;
  } catch {
    ptyModule = null;
  }
  return ptyModule;
}

export function setPtyModuleForTesting(mockPty: PtyModule | null | undefined) {
  ptyModule = mockPty;
}

export function inferShellKind(file: string): TerminalShellKind {
  const normalized = file.toLowerCase();
  if (normalized.endsWith('cmd.exe') || normalized === 'cmd') return 'cmd';
  if (normalized.includes('powershell') || normalized.endsWith('pwsh.exe') || normalized === 'pwsh') {
    return 'powershell';
  }
  return 'posix';
}

export function windowsBashCandidates(): ShellConfig[] {
  const candidates = [
    'C:\\Program Files\\Git\\bin\\bash.exe',
    'C:\\Program Files\\Git\\usr\\bin\\bash.exe',
    'bash.exe',
  ];

  return candidates
    .filter((file, index) => index === candidates.length - 1 || fs.existsSync(file))
    .map((file) => ({
      file,
      args: ['--login', '-i'],
      kind: 'posix' as const,
      preference: 'bash' as const,
    }));
}

export function powershellCandidate(): ShellConfig {
  return {
    file: 'powershell.exe',
    args: ['-NoLogo', '-NoProfile', '-ExecutionPolicy', 'Bypass'],
    kind: 'powershell',
    preference: 'powershell',
  };
}

export function cmdCandidate(): ShellConfig {
  return {
    file: 'cmd.exe',
    args: [],
    kind: 'cmd',
    preference: 'cmd',
  };
}

export function getShellCandidates(shellPreference: TerminalShellPreference = 'auto'): ShellConfig[] {
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

  return [{
    file: process.env.SHELL || '/bin/bash',
    args: [],
    kind: 'posix',
    preference: shellPreference,
  }];
}

function sendToOwner(session: TerminalSession, channel: 'terminal:data', payload: TerminalDataEvent) {
  if (session.owner.isDestroyed()) return;
  session.owner.send(channel, payload);
}

function sendSessionExit(session: TerminalSession, payload: TerminalSessionExitEvent) {
  if (session.owner.isDestroyed()) return;
  session.owner.send('terminal:session-exit', payload);
}

function handleProcessExit(sessionId: string, exitCode: number | null) {
  const session = sessions.get(sessionId);
  if (!session) return;
  sessions.delete(sessionId);
  sendSessionExit(session, {
    sessionId: session.id,
    exitCode,
    reason: 'exited',
  });
}

export function disposeSession(sessionId: string, reason: TerminalSessionExitEvent['reason'] = 'disposed'): boolean {
  const session = sessions.get(sessionId);
  if (!session) return false;
  sessions.delete(sessionId);
  sendSessionExit(session, {
    sessionId: session.id,
    exitCode: null,
    reason,
  });
  try {
    session.pty.kill();
  } catch {
    // Process might already be dead
  }
  return true;
}

export function disposeAllSessionsForOwner(owner: Electron.WebContents) {
  for (const [id, session] of sessions.entries()) {
    if (session.owner === owner) {
      disposeSession(id);
    }
  }
}

export function getOwnedSession(event: IpcMainInvokeEvent, sessionId: string): TerminalSession | null {
  const session = sessions.get(sessionId);
  if (!session) return null;
  if (session.owner !== event.sender) return null;
  return session;
}

export function registerTerminalHandlers() {
  ipcMain.handle('terminal-create', async (event, options: TerminalCreateOptions): Promise<TerminalSessionInfo> => {
    const cwd = requireTrustedRepoRoot(event, options.cwd);
    const pty = getPtyModule();
    if (!pty) {
      throw new Error('node-pty is not available. Ensure native dependencies are compiled for Electron.');
    }

    const shellCandidates = getShellCandidates(options.shellPreference);
    const id = randomUUID();
    const webContents = event.sender;
    const onExit = (exitCode: number | null) => handleProcessExit(id, exitCode);

    let session: TerminalSession | null = null;
    let ptyProcess: PtyProcess | null = null;
    let selectedShell: ShellConfig | null = null;
    const startupErrors: string[] = [];

    for (const shell of shellCandidates) {
      try {
        ptyProcess = pty.spawn(shell.file, shell.args, {
          name: 'xterm-256color',
          cols: options.cols || 80,
          rows: options.rows || 24,
          cwd,
          env: process.env,
        });
        selectedShell = shell;
        break;
      } catch (error) {
        startupErrors.push(`${shell.file}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    if (!ptyProcess || !selectedShell) {
      throw new Error(`Unable to start terminal shell with node-pty. ${startupErrors.join(' | ')}`);
    }

    session = {
      id,
      owner: webContents,
      pty: ptyProcess,
      cwd,
      shell: selectedShell.file,
      shellPreference: selectedShell.preference,
    };

    sessions.set(id, session);

    ptyProcess.onData((data: string) => {
      if (session) {
        sendToOwner(session, 'terminal:data', {
          sessionId: id,
          data,
        });
      }
    });

    ptyProcess.onExit((event) => {
      onExit(event.exitCode ?? null);
    });

    const ownerWindow = BrowserWindow.fromWebContents(webContents);
    ownerWindow?.once('closed', () => disposeSession(id));

    return {
      sessionId: id,
      cwd,
      shell: selectedShell.file,
      shellKind: selectedShell.kind,
      shellPreference: selectedShell.preference,
    };
  });

  ipcMain.handle('terminal-write', (event, sessionId: string, data: string): boolean => {
    const session = getOwnedSession(event, sessionId);
    if (!session) return false;
    session.pty.write(data);
    return true;
  });

  ipcMain.handle('terminal-resize', (event, sessionId: string, cols: number, rows: number): boolean => {
    const session = getOwnedSession(event, sessionId);
    if (!session) return false;
    session.pty.resize(cols, rows);
    return true;
  });

  ipcMain.handle('terminal-dispose', (event, sessionId: string): boolean => {
    const session = getOwnedSession(event, sessionId);
    if (!session) return false;
    return disposeSession(sessionId);
  });
}
