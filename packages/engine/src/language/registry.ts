import { StructuralLanguageAdapter } from './types';
import { jsTsAdapter } from './jsTsAdapter';

const adapters: StructuralLanguageAdapter[] = [jsTsAdapter];

export function resolveStructuralAdapter(filePath: string): StructuralLanguageAdapter {
  const adapter = adapters.find((candidate) => candidate.supportsFile(filePath));
  if (!adapter) {
    throw new Error(`Structural mode is unsupported for file type: ${filePath}. File was not modified.`);
  }
  return adapter;
}
