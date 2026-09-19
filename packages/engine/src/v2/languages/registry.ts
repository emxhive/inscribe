import * as path from 'path';
import { V2LanguageAdapter, isV2StructuralKind } from './types';

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

function validateAdapter(adapter: V2LanguageAdapter): void {
  if (!adapter || typeof adapter.id !== 'string' || adapter.id.trim() === '') {
    throw new Error('Invalid language adapter: id is required');
  }
  if (!Array.isArray(adapter.extensions) || adapter.extensions.length === 0) {
    throw new Error(`Invalid language adapter "${adapter.id}": extensions are required`);
  }
  if (typeof adapter.resolveCandidates !== 'function') {
    throw new Error(`Invalid language adapter "${adapter.id}": resolveCandidates is required`);
  }
  if (!Array.isArray(adapter.supportedKinds) || adapter.supportedKinds.length === 0) {
    throw new Error(`Invalid language adapter "${adapter.id}": supportedKinds are required`);
  }

  const supportedKinds = new Set(adapter.supportedKinds);
  if (
    supportedKinds.size !== adapter.supportedKinds.length ||
    adapter.supportedKinds.some((kind) => !isV2StructuralKind(kind))
  ) {
    throw new Error(`Invalid language adapter "${adapter.id}": supportedKinds are invalid`);
  }
}

/**
 * Deterministic extension-to-adapter registry for V2 structural languages.
 *
 * Registration is intentionally strict. An extension has exactly one owner,
 * and duplicate adapter ids or extensions fail at construction time instead
 * of depending on registration order.
 */
export class V2LanguageRegistry {
  private readonly adaptersByExtension = new Map<string, V2LanguageAdapter>();
  private readonly adaptersById = new Map<string, V2LanguageAdapter>();

  constructor(adapters: readonly V2LanguageAdapter[] = []) {
    for (const adapter of adapters) {
      this.register(adapter);
    }
  }

  register(adapter: V2LanguageAdapter): this {
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

  resolve(filePath: string): V2LanguageAdapter | undefined {
    return this.adaptersByExtension.get(path.extname(filePath).toLowerCase());
  }

  resolveExtension(extension: string): V2LanguageAdapter | undefined {
    return this.adaptersByExtension.get(normalizeExtension(extension));
  }

  require(filePath: string): V2LanguageAdapter {
    const adapter = this.resolve(filePath);
    if (!adapter) {
      throw new Error(`Structural mode is unsupported for file type: ${filePath}. File was not modified.`);
    }
    return adapter;
  }

  getAdapters(): readonly V2LanguageAdapter[] {
    return Object.freeze(Array.from(this.adaptersById.values()));
  }
}

export function createV2LanguageRegistry(
  adapters: readonly V2LanguageAdapter[] = [],
): V2LanguageRegistry {
  return new V2LanguageRegistry(adapters);
}
