import Parser from 'web-tree-sitter';
import { TreeSitterAssetPaths } from '../../structural/treeSitterRuntime';
import {
  FLUTTER_STRUCTURAL_KINDS,
  StructuralCandidateQuery,
  StructuralKind,
  TreeSitterLanguageAdapter,
  STRUCTURAL_KINDS,
} from '../types';
import {
  createTreeSitterLanguageAdapter,
  TreeSitterCandidateCollection,
  TreeSitterStructuralSearchScope,
} from '../treeSitterAdapter';
import { collectDartCandidateCollection } from '../dartAdapter';
import { collectFlutterSourceContext } from './flutterContext';
import { FlutterStructuralMatch } from './flutterMatches';
import { isFlutterSource } from './flutterSemantics';
import { collectFlutterMatches } from './flutterTraversal';
import type { TreeSitterParserEvidence } from '../../structural/treeSitterParserEvidence';

const DART_EXTENSIONS = ['.dart'] as const;
const FLUTTER_KINDS = new Set<StructuralKind>(FLUTTER_STRUCTURAL_KINDS);

export { isFlutterSource };

function grammarIdForFile(_filePath: string): string {
  return 'dart';
}

function collectCandidates(
  rootNode: Parser.SyntaxNode,
  query: StructuralCandidateQuery,
  parserEvidence: TreeSitterParserEvidence,
): TreeSitterCandidateCollection {
  const hasFlutterSelector = query.path.some((segment) => FLUTTER_KINDS.has(segment.kind));

  if (!hasFlutterSelector) {
    return collectDartCandidateCollection(rootNode, query, parserEvidence);
  }

  if (!isFlutterSource(query.source)) {
    return { candidates: [], searchScopes: [], discoveryComplete: true };
  }

  const context = collectFlutterSourceContext(rootNode, query.source);
  const matches: FlutterStructuralMatch[] = [];
  const searchScopes: TreeSitterStructuralSearchScope[] = [];
  collectFlutterMatches(rootNode, query.path, 0, matches, query, context, searchScopes, parserEvidence);
  return {
    candidates: matches.map((match) => ({
      kind: match.kind,
      name: match.name,
      replacement: match.replacement,
      reliabilityNode: match.traversalNode,
      identityRange: match.identityRange,
      identityNode: match.identityNode,
      discoveryScope: match.discoveryScope,
    })),
    searchScopes,
    discoveryComplete: true,
  };
}

export function createFlutterLanguageAdapter(
  assets: TreeSitterAssetPaths,
): TreeSitterLanguageAdapter {
  return createTreeSitterLanguageAdapter({
    id: 'flutter',
    extensions: DART_EXTENSIONS,
    supportedKinds: [...STRUCTURAL_KINDS, ...FLUTTER_STRUCTURAL_KINDS],
    grammarIdForFile,
    collectCandidates,
  }, assets);
}
