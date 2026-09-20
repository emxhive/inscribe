import * as path from 'path';
import {
  hasStructuralCapabilities,
  LanguageAdapter,
  StructuralLanguageAdapter,
  isStructuralKind,
} from './types';

function normalizeExtension(extension: string): string {
  if (typeof extension !== 'string') {
    throw new Error(`Invalid language adapter extension: ${String(extension)}`);
  }
  const normalized = extension.trim().toLowerCase();
  if (!normalized || !normalized.startsWith('.') || normalized === '.') {
    throw new Error(`Invalid language adapter extension: ${extension}`);
  }
  return normalized;
}

function validateAdapter(adapter: LanguageAdapter): void {
  if (!adapter || typeof adapter.id !== 'string' || adapter.id.trim() === '') {
    throw new Error('Invalid language adapter: id is required');
  }
  if (!Array.isArray(adapter.extensions) || adapter.extensions.length === 0) {
    throw new Error(`Invalid language adapter "${adapter.id}": extensions are required`);
  }
  if (adapter.validateSyntax !== undefined && typeof adapter.validateSyntax !== 'function') {
    throw new Error(`Invalid language adapter "${adapter.id}": validateSyntax must be a function`);
  }

  if (adapter.structural !== undefined) {
    if (!adapter.structural || typeof adapter.structural.resolveCandidates !== 'function') {
      throw new Error(`Invalid language adapter "${adapter.id}": structural.resolveCandidates is required`);
    }
    if (!Array.isArray(adapter.structural.supportedKinds) || adapter.structural.supportedKinds.length === 0) {
      throw new Error(`Invalid language adapter "${adapter.id}": structural.supportedKinds are required`);
    }

    const supportedKinds = new Set(adapter.structural.supportedKinds);
    if (
      supportedKinds.size !== adapter.structural.supportedKinds.length ||
      adapter.structural.supportedKinds.some((kind) => !isStructuralKind(kind))
    ) {
      throw new Error(`Invalid language adapter "${adapter.id}": structural.supportedKinds are invalid`);
    }
  }

  if (adapter.structural === undefined && adapter.validateSyntax === undefined) {
    throw new Error(`Invalid language adapter "${adapter.id}": at least one capability is required`);
  }
}

/**
 * Deterministic extension-to-adapter registry for language capabilities.
 *
 * Registration is intentionally strict. An extension has exactly one owner,
 * and duplicate adapter ids or extensions fail at construction time instead
 * of depending on registration order.
 */
export class LanguageRegistry {
  private readonly adaptersByExtension = new Map<string, LanguageAdapter>();
  private readonly adaptersById = new Map<string, LanguageAdapter>();

  constructor(adapters: readonly LanguageAdapter[] = []) {
    for (const adapter of adapters) {
      this.register(adapter);
    }
  }

  register(adapter: LanguageAdapter): this {
    validateAdapter(adapter);

    const id = adapter.id.trim();
    if (this.adaptersById.has(id)) {
      throw new Error(`Duplicate language adapter id: ${id}`);
    }

    const extensions = adapter.extensions.map(normalizeExtension);
    const uniqueExtensions = new Set(extensions);
    if (uniqueExtensions.size !== extensions.length) {
      throw new Error(`Duplicate extension in language adapter "${id}"`);
    }

    for (const extension of extensions) {
      const existing = this.adaptersByExtension.get(extension);
      if (existing) {
        throw new Error(
          `Extension "${extension}" is already registered by language adapter "${existing.id}"`,
        );
      }
    }

    // Keep the adapter instance intact. The registry normalizes only its
    // lookup keys and never mutates language-owned adapter metadata.
    this.adaptersById.set(id, adapter);
    for (const extension of extensions) {
      this.adaptersByExtension.set(extension, adapter);
    }
    return this;
  }

  resolve(filePath: string): LanguageAdapter | undefined {
    return this.adaptersByExtension.get(path.extname(filePath).toLowerCase());
  }

  resolveExtension(extension: string): LanguageAdapter | undefined {
    return this.adaptersByExtension.get(normalizeExtension(extension));
  }

  require(filePath: string): StructuralLanguageAdapter {
    const adapter = this.resolve(filePath);
    if (!adapter || !hasStructuralCapabilities(adapter)) {
      throw new Error(`Structural mode is unsupported for file type: ${filePath}. File was not modified.`);
    }
    return adapter;
  }

  getAdapters(): readonly LanguageAdapter[] {
    return Object.freeze(Array.from(this.adaptersById.values()));
  }
}

export function createLanguageRegistry(
  adapters: readonly LanguageAdapter[] = [],
): LanguageRegistry {
  return new LanguageRegistry(adapters);
}
