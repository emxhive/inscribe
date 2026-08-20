import type { TerminalShellKind } from '../types';

function normalizeTerminalCommand(shellKind: TerminalShellKind, command: string): string {
  let normalized = command;

  switch (shellKind) {
    case 'powershell':
      normalized = normalized.replace(/`[ \t]*(?:\r\n|\r|\n)[ \t]*/g, '');
      break;
    case 'cmd':
      normalized = normalized.replace(/\^[ \t]*(?:\r\n|\r|\n)[ \t]*/g, '');
      break;
    case 'posix':
    default:
      normalized = normalized.replace(/\\[ \t]*(?:\r\n|\r|\n)[ \t]*/g, '');
      break;
  }

  return normalized.replace(/\r\n|\r|\n/g, ' ');
}

/**
 * Builds the shell-specific control sequence to clear/revert the current prompt line
 * and write replacement command text without sending Enter/newline.
 *
 * Any physical line breaks in command text are normalized before insertion so
 * recalling a suggestion cannot submit partial input to the interactive shell.
 *
 * - POSIX (Bash/Zsh): \x01 (Ctrl+A / beginning-of-line) + \x0b (Ctrl+K / kill-to-end-of-line) + command
 * - PowerShell (PSReadLine): \x1b (Escape / RevertLine) + command
 * - cmd.exe: \x1b (Escape / clear line) + command
 */
export function buildTerminalLineReplacement(shellKind: TerminalShellKind, command: string): string {
  const normalizedCommand = normalizeTerminalCommand(shellKind, command);

  switch (shellKind) {
    case 'cmd':
    case 'powershell':
      return `\x1b${normalizedCommand}`;
    case 'posix':
    default:
      return `\x01\x0b${normalizedCommand}`;
  }
}