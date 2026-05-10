import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { StructuralLanguageAdapter, StructuralSymbolRange } from './types';

const PHP_EXTENSIONS = new Set(['.php', '.phtml']);

function supportsPhpFile(filePath: string): boolean {
  const dot = filePath.lastIndexOf('.');
  return dot !== -1 && PHP_EXTENSIONS.has(filePath.slice(dot));
}

function findMatchingBrace(content: string, openIndex: number): number {
  let depth = 0;
  for (let i = openIndex; i < content.length; i++) {
    const ch = content[i];
    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function collectPhpSymbolRanges(content: string, name: string): StructuralSymbolRange[] {
  const ranges: StructuralSymbolRange[] = [];
  const seen = new Set<string>();
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const methodPattern = new RegExp(`(?:public|protected|private)?\\s*(?:static\\s+)?function\\s+&?${escapedName}\\s*\\(`, 'g');
  for (const pattern of [methodPattern]) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(content)) !== null) {
      const start = match.index;
      const open = content.indexOf('{', pattern.lastIndex);
      if (open === -1) continue;
      const close = findMatchingBrace(content, open);
      if (close === -1) continue;
      const key = `${start}:${close + 1}`;
      if (seen.has(key)) continue;
      seen.add(key);
      ranges.push({ start, end: close + 1, description: `PhpFunction at offset ${start}` });
    }
  }

  return ranges;
}

function validatePhpCandidateOrThrow(filePath: string, candidate: string): void {
  let tempFile = '';
  try {
    tempFile = path.join(os.tmpdir(), `inscribe-php-${Date.now()}-${Math.random().toString(36).slice(2)}.php`);
    fs.writeFileSync(tempFile, candidate, 'utf-8');
    execFileSync('php', ['-l', tempFile], { stdio: 'pipe' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown PHP parse error';
    throw new Error([
      'INSCRIBE_PARSE_ERROR',
      `File: ${filePath}`,
      'Operation: php_candidate_validation',
      'Status: blocked_before_write',
      `Message: ${message}`,
      '',
      'Note:',
      'The patch was applied only to an in-memory candidate.',
      'The real file was not modified.',
    ].join('\n'));
  } finally {
    if (tempFile && fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
  }
}

export const phpAdapter: StructuralLanguageAdapter = {
  id: 'php-basic',
  supportsFile(filePath: string): boolean {
    return supportsPhpFile(filePath);
  },
  resolveSymbolDeclarationRange(content: string, name: string): StructuralSymbolRange {
    const matches = collectPhpSymbolRanges(content, name);
    if (matches.length === 0) {
      throw new Error(`Structural symbol target not found.\n\nMODE: replace_symbol\nNAME: ${name}\n\nNo matching PHP function or method declaration was found.\nFile was not modified.`);
    }
    if (matches.length > 1) {
      throw new Error(`Structural symbol target is ambiguous.\n\nMODE: replace_symbol\nNAME: ${name}\n\nMatched ${matches.length} PHP declarations.\nFile was not modified.`);
    }
    return matches[0];
  },
  validateCandidate(filePath: string, candidate: string): void {
    validatePhpCandidateOrThrow(filePath, candidate);
  },
};
