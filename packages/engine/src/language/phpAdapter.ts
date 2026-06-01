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

const PHP_EXTENSIONS = new Set(['.php', '.phtml']);
const HELPER_ROOT = path.join(__dirname, '..', '..', 'bin', 'php_helper');
const PHP_INSTALL_HINT = 'Install PHP and run `composer install` in packages/engine/bin/php_helper.';

type PhpHelperResult =
  | { status: 'SUCCESS'; startByte: number; endByte: number; description: string }
  | { status: 'NOT_FOUND' }
  | { status: 'AMBIGUOUS'; matches: string[] }
  | { status: 'PARSE_ERROR'; message: string }
  | { status: 'VALID' }
  | { status: 'INVALID'; message: string };

function supportsPhpFile(filePath: string): boolean {
  const dot = filePath.lastIndexOf('.');
  return dot !== -1 && PHP_EXTENSIONS.has(filePath.slice(dot));
}

function runPhpHelper(script: string, args: string[]): string {
  return runHelperCommand({
    language: 'PHP',
    executable: 'php',
    args: [path.join(HELPER_ROOT, 'bin', script), ...args],
    cwd: HELPER_ROOT,
    installHint: PHP_INSTALL_HINT,
  });
}

function parsePhpHelperOutput(output: string): PhpHelperResult {
  return parseHelperJson<PhpHelperResult>('PHP', output);
}

function byteOffsetToStringIndex(content: string, byteOffset: number): number {
  if (!Number.isInteger(byteOffset) || byteOffset < 0) {
    throw new Error(`PHP helper returned invalid byte offset: ${byteOffset}`);
  }

  let bytes = 0;
  for (let index = 0; index < content.length;) {
    if (bytes === byteOffset) return index;

    const codePoint = content.codePointAt(index);
    if (codePoint === undefined) break;

    const char = String.fromCodePoint(codePoint);
    const nextBytes = bytes + Buffer.byteLength(char, 'utf-8');
    if (byteOffset < nextBytes) {
      throw new Error(`PHP helper returned non-character-boundary byte offset: ${byteOffset}`);
    }

    bytes = nextBytes;
    index += char.length;
  }

  if (bytes === byteOffset) return content.length;
  throw new Error(`PHP helper returned byte offset outside source: ${byteOffset}`);
}

function rangeFromByteOffsets(content: string, result: Extract<PhpHelperResult, { status: 'SUCCESS' }>): StructuralSymbolRange {
  return {
    start: byteOffsetToStringIndex(content, result.startByte),
    end: byteOffsetToStringIndex(content, result.endByte),
    description: result.description,
  };
}

export const phpAdapter: StructuralLanguageAdapter = {
  id: 'php-parser',
  supportsFile(filePath: string): boolean {
    return supportsPhpFile(filePath);
  },
  resolveSymbolDeclarationRange(content: string, name: string): StructuralSymbolRange {
    return withTempSourceFile('inscribe-php-resolve-', '.php', content, (tempFile) => {
      const output = runPhpHelper('resolver.php', [tempFile, name]);
      const result = parsePhpHelperOutput(output);

      if (result.status === 'SUCCESS') {
        return rangeFromByteOffsets(content, result);
      }

      if (result.status === 'NOT_FOUND') {
        throw formatNotFound('PHP', name, 'declaration');
      }

      if (result.status === 'AMBIGUOUS') {
        throw formatAmbiguous(name, result.matches);
      }

      if (result.status === 'PARSE_ERROR') {
        throw new Error([
          'Structural PHP source could not be parsed.',
          '',
          'MODE: replace_symbol',
          `NAME: ${name}`,
          '',
          `Message: ${result.message}`,
          'File was not modified.',
        ].join('\n'));
      }

      throw new Error(`Unexpected response from PHP resolver: ${output}`);
    });
  },
  validateCandidate(filePath: string, candidate: string): void {
    withTempSourceFile('inscribe-php-validate-', '.php', candidate, (tempFile) => {
      const output = runPhpHelper('validator.php', [tempFile]);
      const result = parsePhpHelperOutput(output);
      if (result.status === 'VALID') return;
      if (result.status === 'INVALID') {
        throw formatCandidateValidationError(filePath, 'php_candidate_validation', result.message);
      }
      throw new Error(`Unexpected response from PHP validator: ${output}`);
    });
  },
};
