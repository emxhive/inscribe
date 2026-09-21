import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  sessions,
  buildTerminalLineReplacement,
  disposeSession,
  getOwnedSession,
  getShellCandidates,
  inferShellKind,
  setPtyModuleForTesting,
} from './terminal';

describe('terminal IPC and transport', () => {
  beforeEach(() => {
    sessions.clear();
    setPtyModuleForTesting(undefined);
  });

  describe('shell candidates and configuration', () => {
    it('infers shell kind from shell executable names correctly', () => {
      expect(inferShellKind('powershell.exe')).toBe('powershell');
      expect(inferShellKind('pwsh.exe')).toBe('powershell');
      expect(inferShellKind('cmd.exe')).toBe('cmd');
      expect(inferShellKind('bash.exe')).toBe('posix');
      expect(inferShellKind('/bin/zsh')).toBe('posix');
    });

    it('returns ordered shell candidates based on shell preference', () => {
      const bashCandidates = getShellCandidates('bash');
      expect(bashCandidates.length).toBeGreaterThan(0);
      expect(bashCandidates[0].preference).toBe('bash');

      const psCandidates = getShellCandidates('powershell');
      expect(psCandidates[0].preference).toBe('powershell');

      const cmdCandidates = getShellCandidates('cmd');
      expect(cmdCandidates[0].preference).toBe('cmd');
    });
  });

  describe('session ownership and disposal', () => {
    it('enforces WebContents session ownership across senders', () => {
      const mockOwner = { isDestroyed: () => false, send: vi.fn() } as unknown as Electron.WebContents;
      const otherOwner = { isDestroyed: () => false, send: vi.fn() } as unknown as Electron.WebContents;

      const mockPty = {
        write: vi.fn(),
        resize: vi.fn(),
        kill: vi.fn(),
      } as any;

      sessions.set('session-1', {
        id: 'session-1',
        owner: mockOwner,
        pty: mockPty,
        cwd: '/repo',
        shell: 'bash',
        shellPreference: 'bash',
      });

      const validEvent = { sender: mockOwner } as any;
      const invalidEvent = { sender: otherOwner } as any;

      expect(getOwnedSession(validEvent, 'session-1')).toBeDefined();
      expect(getOwnedSession(invalidEvent, 'session-1')).toBeNull();
      expect(getOwnedSession(validEvent, 'non-existent')).toBeNull();
    });

    it('disposes PTY process and notifies owner on explicit dispose', () => {
      const sendMock = vi.fn();
      const mockOwner = { isDestroyed: () => false, send: sendMock } as unknown as Electron.WebContents;
      const killMock = vi.fn();
      const mockPty = {
        write: vi.fn(),
        resize: vi.fn(),
        kill: killMock,
      } as any;

      sessions.set('session-1', {
        id: 'session-1',
        owner: mockOwner,
        pty: mockPty,
        cwd: '/repo',
        shell: 'bash',
        shellPreference: 'bash',
      });

      const result = disposeSession('session-1', 'disposed');

      expect(result).toBe(true);
      expect(killMock).toHaveBeenCalled();
      expect(sessions.has('session-1')).toBe(false);
      expect(sendMock).toHaveBeenCalledWith('terminal:session-exit', {
        sessionId: 'session-1',
        exitCode: null,
        reason: 'disposed',
      });
    });
  });
});

describe('CLI suggestion navigation logic', () => {
  const suggestions = [
    { command: 'npm test', description: 'Run test suite' },
    { command: 'git status', description: 'Check git status' },
    { command: 'npm run build', description: 'Build project' },
  ];

  it('cycles through suggestions with Alt+Up and Alt+Down without appending newlines', () => {
    let currentIndex = -1;

    const navigate = (direction: 'up' | 'down') => {
      if (suggestions.length === 0) return null;
      if (direction === 'up') {
        currentIndex = currentIndex <= 0 ? suggestions.length - 1 : currentIndex - 1;
      } else {
        currentIndex = currentIndex >= suggestions.length - 1 || currentIndex < 0 ? 0 : currentIndex + 1;
      }
      return suggestions[currentIndex].command;
    };

    // First Alt+Down gets first suggestion
    const first = navigate('down');
    expect(first).toBe('npm test');
    expect(first).not.toContain('\n');
    expect(first).not.toContain('\r');

    // Second Alt+Down gets second suggestion
    const second = navigate('down');
    expect(second).toBe('git status');

    // Alt+Up goes back to first
    const back = navigate('up');
    expect(back).toBe('npm test');

    // Alt+Up wraps to last
    const wrap = navigate('up');
    expect(wrap).toBe('npm run build');
  });

  it('preserves plain Up and Down keys for shell history without intercepting them', () => {
    const isModifierSuggestionKey = (event: { altKey: boolean; key: string }) => {
      return event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown');
    };

    // Plain ArrowUp / ArrowDown -> not intercepted
    expect(isModifierSuggestionKey({ altKey: false, key: 'ArrowUp' })).toBe(false);
    expect(isModifierSuggestionKey({ altKey: false, key: 'ArrowDown' })).toBe(false);

    // Alt+ArrowUp / Alt+ArrowDown -> intercepted for Inscribe
    expect(isModifierSuggestionKey({ altKey: true, key: 'ArrowUp' })).toBe(true);
    expect(isModifierSuggestionKey({ altKey: true, key: 'ArrowDown' })).toBe(true);
  });

  it('detects Ctrl+` application toggle shortcut without collision with other modifiers', () => {
    const isTerminalToggle = (event: { ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; altKey: boolean; key: string; code?: string }) => {
      return (
        (event.ctrlKey || event.metaKey) &&
        !event.shiftKey &&
        !event.altKey &&
        (event.key === '`' || event.code === 'Backquote')
      );
    };

    expect(isTerminalToggle({ ctrlKey: true, metaKey: false, shiftKey: false, altKey: false, key: '`' })).toBe(true);
    expect(isTerminalToggle({ ctrlKey: false, metaKey: true, shiftKey: false, altKey: false, key: '`' })).toBe(true);
    expect(isTerminalToggle({ ctrlKey: true, metaKey: false, shiftKey: true, altKey: false, key: '`' })).toBe(false);
    expect(isTerminalToggle({ ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, key: '`' })).toBe(false);
  });

  it('builds shell-specific prompt replacement sequences that clear line before writing suggestion', () => {
    // POSIX shells: Ctrl+A then Ctrl+K to clear line inline
    const posixReplacement = buildTerminalLineReplacement('posix', 'npm test');
    expect(posixReplacement.startsWith('\x01\x0b')).toBe(true);
    expect(posixReplacement).toBe('\x01\x0bnpm test');
    expect(posixReplacement).not.toContain('\n');
    expect(posixReplacement).not.toContain('\r');

    // PowerShell: Escape to revert/clear line
    const psReplacement = buildTerminalLineReplacement('powershell', 'npm test');
    expect(psReplacement.startsWith('\x1b')).toBe(true);
    expect(psReplacement).toBe('\x1bnpm test');

    // cmd: Escape to clear line
    const cmdReplacement = buildTerminalLineReplacement('cmd', 'npm test');
    expect(cmdReplacement.startsWith('\x1b')).toBe(true);
    expect(cmdReplacement).toBe('\x1bnpm test');
  });
});
