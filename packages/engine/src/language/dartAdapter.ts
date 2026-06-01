import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { StructuralLanguageAdapter, StructuralSymbolRange } from './types';

const DART_EXTENSIONS = new Set(['.dart']);

// Locate the dart_helper directory relative to this file
// In source: packages/engine/src/language/dartAdapter.ts
// bin is at: packages/engine/bin/dart_helper
const HELPER_ROOT = path.join(__dirname, '..', '..', 'bin', 'dart_helper');

function supportsDartFile(filePath: string): boolean {
  const dot = filePath.lastIndexOf('.');
  return dot !== -1 && DART_EXTENSIONS.has(filePath.slice(dot));
}

function runDartHelper(script: string, args: string[]): string {
  const binaryName = script.replace('.dart', '');
  const isWindows = process.platform === 'win32';
  const binaryPath = path.join(HELPER_ROOT, 'bin', isWindows ? `${binaryName}.exe` : binaryName);

  try {
    if (fs.existsSync(binaryPath)) {
      try {
        return execFileSync(binaryPath, args, {
          cwd: HELPER_ROOT,
          stdio: ['ignore', 'pipe', 'pipe'],
          encoding: 'utf-8',
        });
      } catch (e) {
        // Fallback to dart run if binary fails (e.g. architecture mismatch)
      }
    }

    return execFileSync('dart', ['run', `bin/${script}`, ...args], {
      cwd: HELPER_ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf-8',
    });
  } catch (error: any) {
    const stderr = error.stderr?.toString() || '';
    const stdout = error.stdout?.toString() || '';
    throw new Error(`Dart helper failed: ${stderr || stdout || error.message}`);
  }
}

export const dartAdapter: StructuralLanguageAdapter = {
  id: 'dart-analyzer',
  supportsFile(filePath: string): boolean {
    return supportsDartFile(filePath);
  },
  resolveSymbolDeclarationRange(content: string, name: string): StructuralSymbolRange {
    // We need to write the content to a temp file because the dart analyzer needs a file path
    const tempFile = path.join(os.tmpdir(), `inscribe-dart-resolve-${Date.now()}-${Math.random().toString(36).slice(2)}.dart`);
    try {
      fs.writeFileSync(tempFile, content, 'utf-8');
      const output = runDartHelper('resolver.dart', [tempFile, name]);
      const result = JSON.parse(output);

      if (result.status === 'NOT_FOUND') {
        throw new Error(`Structural symbol target not found.\n\nMODE: replace_symbol\nNAME: ${name}\n\nNo matching Dart declaration was found.\nFile was not modified.`);
      }

      if (result.status === 'AMBIGUOUS') {
        const list = result.matches.map((m: string, i: number) => `${i + 1}. ${m}`).join('\n');
        throw new Error(`Structural symbol target is ambiguous.\n\nMODE: replace_symbol\nNAME: ${name}\n\nMatched ${result.matches.length} declarations:\n${list}\n\nFile was not modified.`);
      }

      if (result.status === 'SUCCESS') {
        return {
          start: result.start,
          end: result.end,
          description: result.description,
        };
      }

      throw new Error(`Unexpected response from Dart resolver: ${output}`);
    } finally {
      if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    }
  },
  validateCandidate(filePath: string, candidate: string): void {
    const tempFile = path.join(os.tmpdir(), `inscribe-dart-validate-${Date.now()}-${Math.random().toString(36).slice(2)}.dart`);
    try {
      fs.writeFileSync(tempFile, candidate, 'utf-8');
      const output = runDartHelper('validator.dart', [tempFile]);
      if (output.trim() === 'INVALID') {
        // This case should be caught by the catch block in runDartHelper if validator.dart exits with 1
        // But we handle it here just in case.
        throw new Error('Dart syntax validation failed.');
      }
    } catch (error: any) {
      const message = error.message || 'Unknown Dart parse error';
      throw new Error([
        'INSCRIBE_PARSE_ERROR',
        `File: ${filePath}`,
        'Operation: dart_candidate_validation',
        'Status: blocked_before_write',
        `Message: ${message}`,
        '',
        'Note:',
        'The patch was applied only to an in-memory candidate.',
        'The real file was not modified.',
      ].join('\n'));
    } finally {
      if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    }
  },
};
