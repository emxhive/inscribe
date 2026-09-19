import * as path from 'path';
import { V2LanguageRegistry } from './registry';
import { SyntaxValidationQuery } from './types';

export type V2SyntaxValidator = (query: SyntaxValidationQuery) => void | Promise<void>;

/**
 * Binds syntax-only validation to the same deterministic language registry
 * used by structural resolution. Adapters that do not expose validation, and
 * extensions with no registered adapter, retain the existing behavior.
 */
export function createAdapterSyntaxValidator(
  registry: V2LanguageRegistry,
): V2SyntaxValidator {
  return async (query): Promise<void> => {
    const adapter = registry.resolve(query.filePath);
    if (!adapter?.validateSyntax) return;

    await adapter.validateSyntax({
      source: query.source,
      filePath: query.filePath,
      extension: path.extname(query.filePath).toLowerCase(),
    });
  };
}
