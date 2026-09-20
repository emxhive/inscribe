import Parser from 'web-tree-sitter';
import { TreeSitterAssetPaths } from '../../structural/treeSitterRuntime';
import {
  FLUTTER_STRUCTURAL_KINDS,
  StructuralCandidateQuery,
  StructuralKind,
  TreeSitterLanguageAdapter,
  V2_STRUCTURAL_KINDS,
} from '../types';
import {
  createTreeSitterLanguageAdapter,
  TreeSitterReplacementCandidate,
} from '../treeSitterAdapter';
import { collectDartCandidates } from '../dartAdapter';
import { collectFlutterSourceContext } from './flutterContext';
import { FlutterStructuralMatch } from './flutterMatches';
import { isFlutterSource } from './flutterSemantics';
import { collectFlutterMatches } from './flutterTraversal';

const DART_EXTENSIONS = ['.dart'] as const;
const FLUTTER_KINDS = new Set<StructuralKind>(FLUTTER_STRUCTURAL_KINDS);

export { isFlutterSource };

function grammarIdForFile(_filePath: string): string {
  return 'dart';
}

function collectCandidates(
  rootNode: Parser.SyntaxNode,
  query: StructuralCandidateQuery,
): readonly TreeSitterReplacementCandidate[] {
  const hasFlutterSelector = query.path.some((segment) => FLUTTER_KINDS.has(segment.kind));

  if (!hasFlutterSelector) {
    return collectDartCandidates(rootNode, query);
  }

  if (!isFlutterSource(query.source)) return [];

  const context = collectFlutterSourceContext(rootNode, query.source);
  const matches: FlutterStructuralMatch[] = [];
  collectFlutterMatches(rootNode, query.path, 0, matches, query, context);
  return matches.map((match) => ({
    kind: match.kind,
    name: match.name,
    replacement: match.replacement,
    reliabilityNode: match.traversalNode,
  }));
}

export function createFlutterLanguageAdapter(
  assets: TreeSitterAssetPaths,
): TreeSitterLanguageAdapter {
  return createTreeSitterLanguageAdapter({
    id: 'flutter-v2',
    extensions: DART_EXTENSIONS,
    supportedKinds: [...V2_STRUCTURAL_KINDS, ...FLUTTER_STRUCTURAL_KINDS],
    grammarIdForFile,
    collectCandidates,
  }, assets);
}
