import { StructuralLanguageAdapter } from './types';
import { jsTsAdapter } from './jsTsAdapter';
import { phpAdapter } from './phpAdapter';

const adapters: StructuralLanguageAdapter[] = [jsTsAdapter, phpAdapter];

export function resolveStructuralAdapter(filePath: string): StructuralLanguageAdapter {
  const adapter = adapters.find((candidate) => candidate.supportsFile(filePath));
  if (!adapter) {
    throw new Error(`Structural mode is unsupported for file type: ${filePath}. File was not modified.`);
  }
  return adapter;
}

export function resolveValidationAdapter(filePath: string): StructuralLanguageAdapter | null {
  return adapters.find((candidate) => candidate.supportsFile(filePath) && typeof candidate.validateCandidate === 'function') ?? null;
}
