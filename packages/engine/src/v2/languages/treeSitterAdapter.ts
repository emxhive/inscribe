import Parser from 'web-tree-sitter';
import { treeSitterRangeToJsRange } from '../structural/treeSitterRangeToJsRange';
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
  TreeSitterLanguageAdapter,
} from './types';

/**
 * Internal Tree-sitter candidate shape used by adapter implementations.
 *
 * `replacementNode` is deliberately required: a semantic match node is not
 * sufficient when the logical replacement boundary is an enclosing wrapper.
 */
export interface TreeSitterReplacementCandidate {
  kind: StructuralKind;
  name?: string;
  replacementNode: Parser.SyntaxNode;
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
    supportedKinds: definition.supportedKinds,
    grammarIdForFile: definition.grammarIdForFile,

    async resolveCandidates(query): Promise<StructuralCandidate[]> {
      try {
        await initTreeSitter(assets);
      } catch (_) {
        throw new Error('RUNTIME_INITIALIZATION_FAILED');
      }

      let language: Parser.Language;
      try {
        language = await loadLanguageForGrammar(
          assets,
          definition.grammarIdForFile(query.filePath),
        );
      } catch (_) {
        throw new Error('MISSING_WASM_ASSET');
      }

      const parser = createParser();
      let tree: Parser.Tree | undefined;

      try {
        parser.setLanguage(language);
        try {
          tree = parser.parse(query.source);
        } catch (_) {
          throw new Error('RUNTIME_INITIALIZATION_FAILED');
        }
        if (tree.rootNode.hasError()) {
          throw new Error('PARSER_DIAGNOSTICS_PRESENT');
        }

        return definition.collectCandidates(tree.rootNode, query).map((candidate) => {
          const range = treeSitterRangeToJsRange(query.source, candidate.replacementNode);
          return {
            kind: candidate.kind,
            name: candidate.name,
            start: range.start,
            end: range.end,
          };
        });
      } finally {
        try {
          tree?.delete();
        } catch (_) {}
        try {
          parser.delete();
        } catch (_) {}
      }
    },
  };
}
