import Parser from 'web-tree-sitter';
import {
  treeSitterByteRangeToJsRange,
  treeSitterRangeToJsRange,
} from '../structural/treeSitterRangeToJsRange';
import {
  collectTreeSitterParserEvidence,
} from '../structural/treeSitterParserEvidence';
import type { TreeSitterParserEvidence } from '../structural/treeSitterParserEvidence';
import {
  createParser,
  initTreeSitter,
  loadLanguageForGrammar,
  TreeSitterAssetPaths,
} from '../structural/treeSitterRuntime';
import {
  StructuralCandidateQuery,
  StructuralCandidateResolution,
  StructuralKind,
  TreeSitterLanguageAdapter,
} from './types';
import {
  assessTreeSitterCandidateReliability,
  assessTreeSitterDiscoveryReliability,
} from './treeSitterReliability';

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
  /**
   * Source region whose recovery could compromise selector identity. This is
   * intentionally narrower than `replacement`: a broken body is not the same
   * fact as an uncertain declaration name.
   */
  identityRange?: TreeSitterReplacementRange;
  /** The syntax node that directly supplies the selector identity, when present. */
  identityNode?: Parser.SyntaxNode;
  /**
   * Node whose identity, ownership and local recovery state are interpreted
   * by the separate Tree-sitter reliability policy.
   */
  reliabilityNode?: Parser.SyntaxNode;
  /** The Tree-sitter node whose traversal space was searched for this candidate. */
  discoveryScope?: Parser.SyntaxNode;
}

export interface TreeSitterStructuralSearchScope {
  node: Parser.SyntaxNode;
  candidateKind: StructuralKind;
  /** Same-kind structural nodes with trustworthy selector identity in this scope. */
  protectedNodes: readonly Parser.SyntaxNode[];
  /** Nodes whose descendants the collector actually entered. */
  traversedNodes: readonly Parser.SyntaxNode[];
  /** Structural-owner branches the collector deliberately did not enter. */
  skippedNodes: readonly Parser.SyntaxNode[];
  /** Recovery regions the language traversal considers able to hide a candidate. */
  discoveryRiskNodes: readonly Parser.SyntaxNode[];
}

export interface TreeSitterCandidateCollection {
  candidates: readonly TreeSitterReplacementCandidate[];
  searchScopes: readonly TreeSitterStructuralSearchScope[];
  /** Whether the adapter provided an authoritative account of its search scopes. */
  discoveryComplete: boolean;
}

export interface TreeSitterLanguageAdapterDefinition {
  id: string;
  extensions: readonly string[];
  supportedKinds: readonly StructuralKind[];
  grammarIdForFile(filePath: string): string;
  collectCandidates(
    rootNode: Parser.SyntaxNode,
    query: StructuralCandidateQuery,
    parserEvidence: TreeSitterParserEvidence,
  ): readonly TreeSitterReplacementCandidate[] | TreeSitterCandidateCollection;
}

/**
 * Builds an adapter around a Tree-sitter grammar.
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
      async resolveCandidates(query): Promise<StructuralCandidateResolution> {
        const grammarId = definition.grammarIdForFile(query.filePath);
        return withParsedTree(query, assets, grammarId, (rootNode, parserEvidence) => {
          const collection = normalizeTreeSitterCandidateCollection(
            definition.collectCandidates(rootNode, query, parserEvidence),
          );
          const candidates = collection.candidates;
          const convertedCandidates = candidates.map((candidate) => {
            const range = candidate.replacement.type === 'node'
              ? treeSitterRangeToJsRange(query.source, candidate.replacement.node)
              : candidate.replacement.range.coordinateSpace === 'js-utf16'
                ? {
                  start: candidate.replacement.range.startIndex,
                  end: candidate.replacement.range.endIndex,
                }
                : treeSitterByteRangeToJsRange(query.source, candidate.replacement.range);

            return {
              candidate,
              range,
              reliability: assessTreeSitterCandidateReliability(
                query.source,
                definition.id,
                grammarId,
                candidate,
                range,
                parserEvidence,
              ),
            };
          });

          const structuralCandidates = convertedCandidates.map(({ candidate, range, reliability }) =>
            reliability
              ? {
                kind: candidate.kind,
                name: candidate.name,
                start: range.start,
                end: range.end,
                reliability,
              }
              : {
                kind: candidate.kind,
                name: candidate.name,
                start: range.start,
                end: range.end,
              },
          );

          const discoveryUncertainty = assessTreeSitterDiscoveryReliability(
            query.source,
            definition.id,
            grammarId,
            collection.searchScopes,
            parserEvidence,
            collection.discoveryComplete,
          );

          return structuralCandidates.some((candidate) => candidate.reliability) || discoveryUncertainty
            ? { candidates: structuralCandidates, discoveryUncertainty }
            : structuralCandidates;
        });
      },
    },
    grammarIdForFile: definition.grammarIdForFile,
  };
}

function normalizeTreeSitterCandidateCollection(
  collection: readonly TreeSitterReplacementCandidate[] | TreeSitterCandidateCollection,
): TreeSitterCandidateCollection {
  return 'candidates' in collection
    ? collection
    : { candidates: collection, searchScopes: [], discoveryComplete: false };
}

async function withParsedTree<T>(
  query: StructuralCandidateQuery,
  assets: TreeSitterAssetPaths,
  grammarId: string,
  callback: (
    rootNode: Parser.SyntaxNode,
    parserEvidence: TreeSitterParserEvidence,
  ) => T | Promise<T>,
): Promise<T> {
  try {
    await initTreeSitter(assets);
  } catch (_) {
    throw new Error('RUNTIME_INITIALIZATION_FAILED');
  }

  let language: Parser.Language;
  try {
    language = await loadLanguageForGrammar(assets, grammarId);
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
    const parserEvidence = collectTreeSitterParserEvidence(tree.rootNode, query.source);
    return await callback(tree.rootNode, parserEvidence);
  } finally {
    try {
      tree?.delete();
    } catch (_) {}
    try {
      parser.delete();
    } catch (_) {}
  }
}
