import Parser from 'web-tree-sitter';
import {
  treeSitterByteRangeToJsRange,
  treeSitterRangeToJsRange,
} from '../structural/treeSitterRangeToJsRange';
import {
  createParser,
  initTreeSitter,
  loadLanguageForGrammar,
  TreeSitterAssetPaths,
} from '../structural/treeSitterRuntime';
import {
  StructuralCandidate,
  StructuralCandidateQuery,
  StructuralKind,
  SyntaxValidationQuery,
  TreeSitterLanguageAdapter,
} from './types';

/**
 * Internal Tree-sitter candidate shape used by adapter implementations.
 *
 * `replacement` is deliberately required: a semantic match node is not
 * sufficient when the logical replacement boundary is an enclosing wrapper
 * or a declaration assembled from sibling nodes.
 */
export interface TreeSitterReplacementRange {
  /** Offsets for the logical replacement boundary. */
  startIndex: number;
  endIndex: number;
  /** Explicit ranges default to UTF-8 byte offsets for compatibility. */
  coordinateSpace?: 'utf8-byte' | 'js-utf16';
}

export type TreeSitterReplacement =
  | { type: 'node'; node: Parser.SyntaxNode }
  | { type: 'range'; range: TreeSitterReplacementRange };

export interface TreeSitterReplacementCandidate {
  kind: StructuralKind;
  name?: string;
  /** The logical replacement boundary, never merely the semantic match node. */
  replacement: TreeSitterReplacement;
}

export interface TreeSitterLanguageAdapterDefinition {
  id: string;
  extensions: readonly string[];
  supportedKinds: readonly StructuralKind[];
  grammarIdForFile(filePath: string): string;
  collectCandidates(
    rootNode: Parser.SyntaxNode,
    query: StructuralCandidateQuery,
  ): readonly TreeSitterReplacementCandidate[];
}

/**
 * Builds a V2 adapter around a Tree-sitter grammar.
 *
 * Tree-sitter nodes are confined to the collector callback. The adapter's
 * public result is converted immediately to logical JS UTF-16 ranges.
 */
export function createTreeSitterLanguageAdapter(
  definition: TreeSitterLanguageAdapterDefinition,
  assets: TreeSitterAssetPaths,
): TreeSitterLanguageAdapter {
  return {
    id: definition.id,
    extensions: definition.extensions,
    structural: {
      supportedKinds: definition.supportedKinds,
      async resolveCandidates(query): Promise<StructuralCandidate[]> {
        return withParsedTree(query, assets, definition.grammarIdForFile, (rootNode) =>
          definition.collectCandidates(rootNode, query).map((candidate) => {
            const range = candidate.replacement.type === 'node'
              ? treeSitterRangeToJsRange(query.source, candidate.replacement.node)
              : candidate.replacement.range.coordinateSpace === 'js-utf16'
                ? {
                  start: candidate.replacement.range.startIndex,
                  end: candidate.replacement.range.endIndex,
                }
                : treeSitterByteRangeToJsRange(query.source, candidate.replacement.range);
            return {
              kind: candidate.kind,
              name: candidate.name,
              start: range.start,
              end: range.end,
            };
          }),
        );
      },
    },
    grammarIdForFile: definition.grammarIdForFile,

    async validateSyntax(query: SyntaxValidationQuery): Promise<void> {
      await withParsedTree(query, assets, definition.grammarIdForFile, () => undefined);
    },
  };
}

async function withParsedTree<T>(
  query: StructuralCandidateQuery | SyntaxValidationQuery,
  assets: TreeSitterAssetPaths,
  grammarIdForFile: (filePath: string) => string,
  callback: (rootNode: Parser.SyntaxNode) => T | Promise<T>,
): Promise<T> {
  try {
    await initTreeSitter(assets);
  } catch (_) {
    throw new Error('RUNTIME_INITIALIZATION_FAILED');
  }

  let language: Parser.Language;
  try {
    language = await loadLanguageForGrammar(assets, grammarIdForFile(query.filePath));
  } catch (_) {
    throw new Error('MISSING_WASM_ASSET');
  }

  const parser = createParser();
  let tree: Parser.Tree | undefined;

  try {
    try {
      parser.setLanguage(language);
      tree = parser.parse(query.source);
    } catch (_) {
      throw new Error('RUNTIME_INITIALIZATION_FAILED');
    }
    if (tree.rootNode.hasError()) {
      throw new Error('PARSER_DIAGNOSTICS_PRESENT');
    }

    return await callback(tree.rootNode);
  } finally {
    try {
      tree?.delete();
    } catch (_) {}
    try {
      parser.delete();
    } catch (_) {}
  }
}
