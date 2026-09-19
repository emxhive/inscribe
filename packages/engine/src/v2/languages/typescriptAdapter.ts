import * as path from 'path';
import Parser from 'web-tree-sitter';
import {
  getLogicalReplacementNode,
  getNodeName,
  isNodeOfKind,
  isStructuralOwner,
} from '../structural/tsxAdapter';
import { TreeSitterAssetPaths } from '../structural/treeSitterRuntime';
import {
  StructuralCandidateQuery,
  StructuralSelectorSegment,
  TreeSitterLanguageAdapter,
  V2_STRUCTURAL_KINDS,
} from './types';
import {
  createTreeSitterLanguageAdapter,
  TreeSitterReplacementCandidate,
} from './treeSitterAdapter';

const TYPESCRIPT_EXTENSIONS = ['.ts', '.tsx'] as const;

function grammarIdForFile(filePath: string): string {
  return path.extname(filePath).toLowerCase() === '.tsx' ? 'tsx' : 'typescript';
}

function collectCandidates(
  rootNode: Parser.SyntaxNode,
  query: StructuralCandidateQuery,
): readonly TreeSitterReplacementCandidate[] {
  const finalKind = query.path[query.path.length - 1].kind;
  const semanticMatches: Parser.SyntaxNode[] = [];
  collectMatches(rootNode, query.path, 0, semanticMatches);

  return semanticMatches.map((semanticNode) => ({
    kind: finalKind,
    name: getNodeName(semanticNode),
    replacementNode: getLogicalReplacementNode(semanticNode, finalKind),
  }));
}

function collectMatches(
  currentNode: Parser.SyntaxNode,
  selectorPath: readonly StructuralSelectorSegment[],
  depth: number,
  results: Parser.SyntaxNode[],
): void {
  const segment = selectorPath[depth];
  const isLast = depth === selectorPath.length - 1;
  const candidates: Parser.SyntaxNode[] = [];

  function traverse(node: Parser.SyntaxNode): void {
    for (let index = 0; index < node.namedChildCount; index++) {
      const child = node.namedChild(index);
      if (!child) continue;

      const isMatch =
        isNodeOfKind(child, segment.kind) &&
        (!segment.name || getNodeName(child) === segment.name);

      if (isMatch) {
        candidates.push(child);
      }

      if (depth > 0 && isStructuralOwner(child)) {
        continue;
      }

      traverse(child);
    }
  }

  traverse(currentNode);

  for (const candidate of candidates) {
    if (isLast) {
      results.push(candidate);
    } else {
      collectMatches(candidate, selectorPath, depth + 1, results);
    }
  }
}

export function createTypeScriptLanguageAdapter(
  assets: TreeSitterAssetPaths,
): TreeSitterLanguageAdapter {
  return createTreeSitterLanguageAdapter({
    id: 'typescript-v2',
    extensions: TYPESCRIPT_EXTENSIONS,
    supportedKinds: V2_STRUCTURAL_KINDS,
    grammarIdForFile,
    collectCandidates,
  }, assets);
}
