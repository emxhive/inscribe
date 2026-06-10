import { spawnSync } from 'child_process';
import * as path from 'path';
import { existsSync } from 'fs';
import { StructuralLanguageAdapter, StructuralSymbolRange } from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DART_EXTENSIONS = new Set(['.dart']);

/** Root directory of the Dart helper package. */
const HELPER_ROOT = path.resolve(
  __dirname,
  '../../bin/dart_helper',
);

/** Absolute path to the Dart helper entry point (for fallback reference if needed). */
const HELPER_PATH = path.join(
  HELPER_ROOT,
  'bin',
  'inscribe_dart_helper.dart',
);

// ---------------------------------------------------------------------------
// Helper protocol types
// ---------------------------------------------------------------------------

interface DartSymbol {
  name: string;
  owner: string | null;
  kind: string;
  start: number;
  end: number;
  description: string;
}

interface HelperResponseOk {
  ok: true;
  symbols?: DartSymbol[];
}

interface HelperResponseError {
  ok: false;
  error: string;
  line?: number;
  column?: number;
  utf16Offset?: number;
}

type HelperResponse = HelperResponseOk | HelperResponseError;

function buildDartInvocation(): {
  command: string;
  args: string[];
} {
  // 1. INSCRIBE_DART_HELPER_PATH override, when defined and the file exists
  if (process.env.INSCRIBE_DART_HELPER_PATH && existsSync(process.env.INSCRIBE_DART_HELPER_PATH)) {
    return {
      command: process.env.INSCRIBE_DART_HELPER_PATH,
      args: [],
    };
  }

  // 2. local platform-specific compiled helper path under packages/engine/bin/dart_helper/dist/
  let platformDir = '';
  let exeName = 'inscribe_dart_helper';
  if (process.platform === 'win32') {
    platformDir = 'windows';
    exeName = 'inscribe_dart_helper.exe';
  } else if (process.platform === 'linux') {
    platformDir = 'linux';
  } else if (process.platform === 'darwin') {
    platformDir = 'macos';
  }

  if (platformDir) {
    const localBin = path.join(HELPER_ROOT, 'dist', platformDir, exeName);
    if (existsSync(localBin)) {
      return {
        command: localBin,
        args: [],
      };
    }
  }

  // 3. existing dart-run development fallback
  if (process.platform === 'win32') {
    return {
      command: process.env.ComSpec ?? 'cmd.exe',
      args: ['/d', '/s', '/c', 'dart run "bin/inscribe_dart_helper.dart"'],
    };
  }

  return {
    command: 'dart',
    args: ['run', 'bin/inscribe_dart_helper.dart'],
  };
}

// ---------------------------------------------------------------------------
// Spawn helper
// ---------------------------------------------------------------------------

function runHelper(request: { action: string; content: string }): HelperResponse {
  const input = JSON.stringify(request);

  const invocation = buildDartInvocation();

  const result = spawnSync(invocation.command, invocation.args, {
    cwd: HELPER_ROOT,
    encoding: 'utf-8',
    input,
    shell: false,
    windowsHide: true,
    windowsVerbatimArguments: process.platform === 'win32',
  });

  // Dart executable not found
  if (result.error) {
    const err = result.error as any;
    if (err.code === 'ENOENT') {
      throw new Error(
        'Dart executable not found. Ensure the Dart SDK is installed and "dart" is on PATH.',
      );
    }
    throw new Error(`dart run failed: ${err.message}`);
  }

  // Handle missing Dart when running via cmd.exe on Windows
  const stderrText = (result.stderr ?? '').toString();
  const stdoutText = (result.stdout ?? '').toString();
  const combinedOutput = (stdoutText + '\n' + stderrText).toLowerCase();

  const isMissingDart =
    result.status === 9009 ||
    combinedOutput.includes("'dart' is not recognized") ||
    combinedOutput.includes("is not recognized as an internal or external command") ||
    combinedOutput.includes("dart: command not found") ||
    combinedOutput.includes("dart: not found");

  if (result.status !== 0 && isMissingDart) {
    throw new Error(
      'Dart executable not found. Ensure the Dart SDK is installed and "dart" is on PATH.',
    );
  }

  const rawStdout = (result.stdout ?? '').trim();

  if (!rawStdout) {
    const stderr = (result.stderr ?? '').trim();
    throw new Error(
      `Dart helper produced no stdout output.${stderr ? `\nstderr: ${stderr}` : ''}`,
    );
  }

  let parsed: HelperResponse;
  try {
    parsed = JSON.parse(rawStdout) as HelperResponse;
  } catch {
    throw new Error(
      `Dart helper emitted malformed JSON.\nRaw stdout: ${rawStdout.slice(0, 300)}`,
    );
  }

  return parsed;
}

// ---------------------------------------------------------------------------
// Symbol resolution
// ---------------------------------------------------------------------------

/** Split 'Owner::name' or 'Owner.name' into [owner, symbol]. */
function splitSelector(name: string): [string | null, string] {
  const colonIdx = name.indexOf('::');
  if (colonIdx > 0) {
    return [name.slice(0, colonIdx), name.slice(colonIdx + 2)];
  }
  const dotIdx = name.indexOf('.');
  if (dotIdx > 0) {
    return [name.slice(0, dotIdx), name.slice(dotIdx + 1)];
  }
  return [null, name];
}

function collectSymbols(content: string): DartSymbol[] {
  const response = runHelper({ action: 'collect_symbols', content });
  if (!response.ok) {
    throw new Error(`Dart helper collect_symbols error: ${response.error}`);
  }
  return response.symbols ?? [];
}

function resolveSymbolDeclarationRange(
  content: string,
  name: string,
): StructuralSymbolRange {
  const [ownerSelector, symbolSelector] = splitSelector(name);
  const allSymbols = collectSymbols(content);

  const matches = allSymbols.filter((s) => {
    if (ownerSelector !== null) {
      return s.owner === ownerSelector && s.name === symbolSelector;
    }
    return s.name === symbolSelector;
  });

  if (matches.length === 0) {
    throw new Error(
      [
        'Structural symbol target not found.',
        '',
        'MODE: replace_symbol',
        `NAME: ${name}`,
        '',
        'No matching Dart class, enum, mixin, extension, function, method, or constructor declaration was found.',
        'For methods and constructors, use ClassName::method or ClassName::new when the bare name is not unique.',
        'File was not modified.',
      ].join('\n'),
    );
  }

  if (matches.length > 1) {
    const list = matches.map((m) => `- ${m.description}`).join('\n');
    throw new Error(
      [
        'Structural symbol target is ambiguous.',
        '',
        'MODE: replace_symbol',
        `NAME: ${name}`,
        '',
        `Matched ${matches.length} Dart declarations:`,
        list,
        '',
        'Use a scoped selector such as ClassName::method for methods when possible.',
        'File was not modified.',
      ].join('\n'),
    );
  }

  const m = matches[0];
  return { start: m.start, end: m.end, description: m.description };
}

// ---------------------------------------------------------------------------
// Candidate validation
// ---------------------------------------------------------------------------

function validateCandidateOrThrow(filePath: string, candidate: string): void {
  const response = runHelper({ action: 'validate_syntax', content: candidate });
  if (response.ok) return;

  const lines = [
    'INSCRIBE_PARSE_ERROR',
    `File: ${filePath}`,
    'Operation: dart_candidate_validation',
    'Status: blocked_before_write',
    `Message: ${response.error}`,
  ];
  if (response.line !== undefined) {
    lines.push(`Line: ${response.line}`);
  }
  if (response.column !== undefined) {
    lines.push(`Column: ${response.column}`);
  }
  lines.push(
    '',
    'Note:',
    'The patch was applied only to an in-memory candidate.',
    'The real file was not modified.',
  );

  throw new Error(lines.join('\n'));
}

// ---------------------------------------------------------------------------
// Adapter export
// ---------------------------------------------------------------------------

export const dartAdapter: StructuralLanguageAdapter = {
  id: 'dart-analyzer',
  supportsFile(filePath: string): boolean {
    const dot = filePath.lastIndexOf('.');
    return dot !== -1 && DART_EXTENSIONS.has(filePath.slice(dot));
  },
  resolveSymbolDeclarationRange(content: string, name: string): StructuralSymbolRange {
    return resolveSymbolDeclarationRange(content, name);
  },
  validateCandidate(filePath: string, candidate: string): void {
    validateCandidateOrThrow(filePath, candidate);
  },
};
