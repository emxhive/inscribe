import type { TerminalShellKind } from '../types';

/**
 * Builds the shell-specific control sequence to clear/revert the current prompt line
 * and write the replacement command text without sending Enter/newline.
 *
 * - POSIX (Bash/Zsh): \x01 (Ctrl+A / beginning-of-line) + \x0b (Ctrl+K / kill-to-end-of-line) + command
 * - PowerShell (PSReadLine): \x1b (Escape / RevertLine) + command
 * - cmd.exe: \x1b (Escape / clear line) + command
 */
export function buildTerminalLineReplacement(shellKind: TerminalShellKind, command: string): string {
  switch (shellKind) {
    case 'cmd':
    case 'powershell':
      return `\x1b${command}`;
    case 'posix':
    default:
      return `\x01\x0b${command}`;
  }
}
