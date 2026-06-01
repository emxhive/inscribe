import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';

export interface HelperCommand {
  language: string;
  executable: string;
  args: string[];
  cwd: string;
  installHint: string;
}

export function runHelperCommand(command: HelperCommand): string {
  try {
    const executable = process.platform === 'win32'
      ? (process.env.ComSpec || 'cmd.exe')
      : command.executable;
    const args = process.platform === 'win32'
      ? ['/d', '/c', [command.executable, ...command.args.map(quoteWindowsCmdArg)].join(' ')]
      : command.args;

    return execFileSync(executable, args, {
      cwd: command.cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf-8',
      windowsVerbatimArguments: process.platform === 'win32',
    });
  } catch (error: any) {
    const stderr = error.stderr?.toString().trim();
    const stdout = error.stdout?.toString().trim();
    const detail = stderr || stdout || error.message || 'Unknown helper failure';
    throw new Error(`${command.language} helper failed: ${detail}\n\n${command.installHint}`);
  }
}

function quoteWindowsCmdArg(arg: string): string {
  return `"${arg.replace(/%/g, '%%').replace(/"/g, '""')}"`;
}

export function withTempSourceFile<T>(
  prefix: string,
  extension: string,
  content: string,
  action: (filePath: string) => T
): T {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const tempFile = path.join(tempDir, `candidate${extension}`);
  try {
    fs.writeFileSync(tempFile, content, 'utf-8');
    return action(tempFile);
  } finally {
    try {
      if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
      if (fs.existsSync(tempDir)) fs.rmdirSync(tempDir);
    } catch {
      // Best-effort cleanup only. The helper never writes outside this directory.
    }
  }
}

export function parseHelperJson<T>(language: string, output: string): T {
  try {
    return JSON.parse(output) as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown JSON parse error';
    throw new Error(`${language} helper returned invalid JSON: ${message}\n\nOutput:\n${output}`);
  }
}

export function formatNotFound(language: string, name: string, supportedDescription: string): Error {
  return new Error([
    'Structural symbol target not found.',
    '',
    'MODE: replace_symbol',
    `NAME: ${name}`,
    '',
    `No matching ${language} ${supportedDescription} was found.`,
    'File was not modified.',
  ].join('\n'));
}

export function formatAmbiguous(name: string, matches: string[]): Error {
  const list = matches.map((match, index) => `${index + 1}. ${match}`).join('\n');
  return new Error([
    'Structural symbol target is ambiguous.',
    '',
    'MODE: replace_symbol',
    `NAME: ${name}`,
    '',
    `Matched ${matches.length} declarations:`,
    list,
    '',
    'File was not modified.',
  ].join('\n'));
}

export function formatCandidateValidationError(
  filePath: string,
  operation: string,
  message: string
): Error {
  return new Error([
    'INSCRIBE_PARSE_ERROR',
    `File: ${filePath}`,
    `Operation: ${operation}`,
    'Status: blocked_before_write',
    `Message: ${message}`,
    '',
    'Note:',
    'The patch was applied only to an in-memory candidate.',
    'The real file was not modified.',
  ].join('\n'));
}
