import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { StructuralLanguageAdapter, StructuralSymbolRange } from './types';
import {
  formatAmbiguous,
  formatCandidateValidationError,
  formatNotFound,
  parseHelperJson,
  runHelperCommand,
  withTempSourceFile,
} from './helperProcess';

const DART_EXTENSIONS = new Set(['.dart']);

const HELPER_ROOT = path.join(__dirname, '..', '..', 'bin', 'dart_helper');
const DART_INSTALL_HINT = 'Install the Dart SDK and run `dart pub get` in packages/engine/bin/dart_helper.';
const KERNEL_CACHE_ROOT = path.join(
  os.tmpdir(),
  'inscribe-dart-helper',
  crypto.createHash('sha1').update(HELPER_ROOT).digest('hex').slice(0, 12)
);

type DartHelperResult =
  | { status: 'SUCCESS'; start: number; end: number; description: string }
  | { status: 'NOT_FOUND' }
  | { status: 'AMBIGUOUS'; matches: string[] }
  | { status: 'PARSE_ERROR'; message: string }
  | { status: 'VALID' }
  | { status: 'INVALID'; message: string };

function supportsDartFile(filePath: string): boolean {
  const dot = filePath.lastIndexOf('.');
  return dot !== -1 && DART_EXTENSIONS.has(filePath.slice(dot));
}

function runDartHelper(script: string, args: string[]): string {
  const kernelPath = ensureDartKernel(script);
  return runHelperCommand({
    language: 'Dart',
    executable: 'dart',
    args: [kernelPath, ...args],
    cwd: HELPER_ROOT,
    installHint: DART_INSTALL_HINT,
  });
}

function ensureDartKernel(script: string): string {
  const scriptPath = path.join(HELPER_ROOT, 'bin', script);
  const lockPath = path.join(HELPER_ROOT, 'pubspec.lock');
  const packageConfigPath = path.join(HELPER_ROOT, '.dart_tool', 'package_config.json');
  const kernelPath = path.join(KERNEL_CACHE_ROOT, `${script.replace(/\.dart$/, '')}.dill`);

  if (isFreshKernel(kernelPath, [scriptPath, lockPath])) {
    return kernelPath;
  }

  if (!fs.existsSync(packageConfigPath)) {
    runHelperCommand({
      language: 'Dart',
      executable: 'dart',
      args: ['pub', 'get'],
      cwd: HELPER_ROOT,
      installHint: DART_INSTALL_HINT,
    });
  }

  fs.mkdirSync(KERNEL_CACHE_ROOT, { recursive: true });
  runHelperCommand({
    language: 'Dart',
    executable: 'dart',
    args: ['compile', 'kernel', `bin/${script}`, '-o', kernelPath],
    cwd: HELPER_ROOT,
    installHint: DART_INSTALL_HINT,
  });

  return kernelPath;
}

function isFreshKernel(kernelPath: string, inputs: string[]): boolean {
  if (!fs.existsSync(kernelPath)) return false;
  const kernelMtime = fs.statSync(kernelPath).mtimeMs;
  return inputs.every((input) => fs.existsSync(input) && fs.statSync(input).mtimeMs <= kernelMtime);
}

function parseDartHelperOutput(output: string): DartHelperResult {
  return parseHelperJson<DartHelperResult>('Dart', output);
}

export const dartAdapter: StructuralLanguageAdapter = {
  id: 'dart-analyzer',
  supportsFile(filePath: string): boolean {
    return supportsDartFile(filePath);
  },
  resolveSymbolDeclarationRange(content: string, name: string): StructuralSymbolRange {
    return withTempSourceFile('inscribe-dart-resolve-', '.dart', content, (tempFile) => {
      const output = runDartHelper('resolver.dart', [tempFile, name]);
      const result = parseDartHelperOutput(output);

      if (result.status === 'NOT_FOUND') {
        throw formatNotFound('Dart', name, 'declaration');
      }

      if (result.status === 'AMBIGUOUS') {
        throw formatAmbiguous(name, result.matches);
      }

      if (result.status === 'PARSE_ERROR') {
        throw new Error([
          'Structural Dart source could not be parsed.',
          '',
          'MODE: replace_symbol',
          `NAME: ${name}`,
          '',
          `Message: ${result.message}`,
          'File was not modified.',
        ].join('\n'));
      }

      if (result.status === 'SUCCESS') {
        return {
          start: result.start,
          end: result.end,
          description: result.description,
        };
      }

      throw new Error(`Unexpected response from Dart resolver: ${output}`);
    });
  },
  validateCandidate(filePath: string, candidate: string): void {
    withTempSourceFile('inscribe-dart-validate-', '.dart', candidate, (tempFile) => {
      const output = runDartHelper('validator.dart', [tempFile]);
      const result = parseDartHelperOutput(output);
      if (result.status === 'VALID') return;
      if (result.status === 'INVALID') {
        throw formatCandidateValidationError(filePath, 'dart_candidate_validation', result.message);
      }
      throw new Error(`Unexpected response from Dart validator: ${output}`);
    });
  },
};
