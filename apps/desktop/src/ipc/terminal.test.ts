import { describe, expect, it } from 'vitest';
import {
  buildSentinelCommandForShell,
  isPotentialInternalLine,
  shouldFlushPartialLine,
} from './terminal';

describe('terminal IPC helpers', () => {
  it('holds partial output while a command is active', () => {
    expect(shouldFlushPartialLine('run-1', 'partial output')).toBe(false);
    expect(shouldFlushPartialLine(null, 'prompt text')).toBe(true);
  });

  it('holds partial internal sentinel output', () => {
    expect(isPotentialInternalLine('__INSCRIBE_EXIT')).toBe(true);
    expect(shouldFlushPartialLine(null, '__INSCRIBE_CWD:run-1')).toBe(false);
  });

  it('uses current cmd ERRORLEVEL directly in the sentinel', () => {
    const command = buildSentinelCommandForShell('cmd', 'run-1');

    expect(command.startsWith('echo(')).toBe(true);
    expect(command).toContain('__INSCRIBE_CWD:run-1:%CD%');
    expect(command).toContain('__INSCRIBE_EXIT:run-1:%ERRORLEVEL%');
    expect(command).not.toContain('%INSCRIBE_EXIT%');
  });

  it('prefixes powershell sentinel output with a blank line', () => {
    const command = buildSentinelCommandForShell('powershell', 'run-1');

    expect(command).toContain('Write-Output ""; Write-Output "__INSCRIBE_CWD:run-1:');
  });
});
