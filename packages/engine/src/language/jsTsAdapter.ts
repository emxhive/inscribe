import { StructuralLanguageAdapter } from './types';
import { resolveSymbolDeclarationRange } from '../apply/structuralResolvers';
import { parse } from '@babel/parser';

const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts', '.mjs', '.cjs']);

export const jsTsAdapter: StructuralLanguageAdapter = {
  id: 'js-ts-babel',
  supportsFile(filePath: string): boolean {
    const dot = filePath.lastIndexOf('.');
    return dot !== -1 && EXTENSIONS.has(filePath.slice(dot));
  },
  resolveSymbolDeclarationRange(content: string, name: string) {
    return resolveSymbolDeclarationRange(content, name);
  },
  validateCandidate(_filePath: string, candidate: string): void {
    parse(candidate, {
      sourceType: 'unambiguous',
      plugins: ['typescript', 'jsx'],
      errorRecovery: false,
    });
  },
};
