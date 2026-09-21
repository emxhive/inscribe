import * as path from 'path';
import { LanguageRegistry } from './registry';
import { SyntaxValidationQuery } from './types';

export type SyntaxValidator = (query: SyntaxValidationQuery) => void | Promise<void>;

/**
 * Binds syntax-only validation to the same deterministic language registry
 * used by structural resolution. Adapters that do not expose validation, and
 * extensions with no registered adapter, retain the existing behavior.
 */
export function createAdapterSyntaxValidator(
  registry: LanguageRegistry,
): SyntaxValidator {
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
