import { StructuralLanguageAdapter } from './types';
import { resolveSymbolDeclarationRange } from '../apply/structuralResolvers';

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
};
