import * as path from 'path';
import Parser from 'web-tree-sitter';
import {
  getLogicalReplacementNode,
  getNodeName,
  isNodeOfKind,
  isStructuralOwner,
} from '../structural/tsxAdapter';
import { treeSitterRangeToJsRange } from '../structural/treeSitterRangeToJsRange';
import {
  collectTreeSitterDiscoveryRiskNodes,
  hasTreeSitterRecoveryAdjacentToNode,
  hasTreeSitterRecoveryInRange,
} from '../structural/treeSitterParserEvidence';
import type { TreeSitterParserEvidence } from '../structural/treeSitterParserEvidence';
import { TreeSitterAssetPaths } from '../structural/treeSitterRuntime';
import {
  StructuralCandidateQuery,
  StructuralSelectorSegment,
  TreeSitterLanguageAdapter,
  STRUCTURAL_KINDS,
} from './types';
import {
  createTreeSitterLanguageAdapter,
  TreeSitterCandidateCollection,
  TreeSitterStructuralSearchScope,
  TreeSitterReplacement,
  TreeSitterReplacementCandidate,
} from './treeSitterAdapter';

const TYPESCRIPT_EXTENSIONS = ['.ts', '.tsx'] as const;

function grammarIdForFile(filePath: string): string {
  return path.extname(filePath).toLowerCase() === '.tsx' ? 'tsx' : 'typescript';
}

function collectCandidates(
  rootNode: Parser.SyntaxNode,
  query: StructuralCandidateQuery,
  parserEvidence: TreeSitterParserEvidence,
): TreeSitterCandidateCollection {
  const finalKind = query.path[query.path.length - 1].kind;
  const semanticMatches: Array<{
    node: Parser.SyntaxNode;
    discoveryScope: Parser.SyntaxNode;
  }> = [];
  const searchScopes: TreeSitterStructuralSearchScope[] = [];
  collectMatches(rootNode, query.path, 0, semanticMatches, searchScopes, query.source, parserEvidence);

  return {
    candidates: semanticMatches.map(({ node, discoveryScope }) => ({
      kind: finalKind,
      name: getNodeName(node),
      replacement: getLogicalReplacement(node, finalKind, query.source),
      reliabilityNode: node,
      identityRange: getIdentityRange(node, finalKind, query.source),
      identityNode: getIdentityNode(node, finalKind),
      discoveryScope,
    })),
    searchScopes,
    discoveryComplete: true,
  };
}

function getIdentityRange(
  node: Parser.SyntaxNode,
  kind: StructuralSelectorSegment['kind'],
  source: string,
): TreeSitterReplacementCandidate['identityRange'] {
  if (kind !== 'class' && kind !== 'constructor' && kind !== 'method' && kind !== 'function') {
    return undefined;
  }

  const nodeRange = treeSitterRangeToJsRange(source, node);
  const nameNode = getIdentityNode(node, kind);
  if (nameNode) {
    const nameRange = treeSitterRangeToJsRange(source, nameNode);
    return {
      startIndex: nameRange.start,
      endIndex: nameRange.end,
      coordinateSpace: 'js-utf16',
    };
  }
  const body = node.childForFieldName('body') ?? node.childForFieldName('value');
  const identityEnd = body ? treeSitterRangeToJsRange(source, body).start : nodeRange.end;
  return {
    startIndex: nodeRange.start,
    endIndex: identityEnd,
    coordinateSpace: 'js-utf16',
  };
}

function getIdentityNode(
  node: Parser.SyntaxNode,
  kind: StructuralSelectorSegment['kind'],
): Parser.SyntaxNode | undefined {
  if (kind !== 'class' && kind !== 'constructor' && kind !== 'method' && kind !== 'function') {
    return undefined;
  }
  return node.childForFieldName('name') ?? undefined;
}

function getLogicalReplacement(
  semanticNode: Parser.SyntaxNode,
  kind: StructuralSelectorSegment['kind'],
  source: string,
): TreeSitterReplacement {
  const logicalNode = getLogicalReplacementNode(semanticNode, kind);
  const startNode = findLeadingDecorator(semanticNode) ?? logicalNode;
  const endNode = findDeclarationTerminator(semanticNode) ?? logicalNode;

  if (startNode.startIndex === logicalNode.startIndex && endNode.endIndex === logicalNode.endIndex) {
    return { type: 'node', node: logicalNode };
  }

  return {
    type: 'range',
    range: {
      startIndex: treeSitterRangeToJsRange(source, startNode).start,
      endIndex: treeSitterRangeToJsRange(source, endNode).end,
      coordinateSpace: 'js-utf16',
    },
  };
}

function findLeadingDecorator(node: Parser.SyntaxNode): Parser.SyntaxNode | undefined {
  if (node.type !== 'method_definition' &&
      node.type !== 'method_signature' &&
      node.type !== 'public_field_definition') {
    return undefined;
  }

  const parent = node.parent;
  if (!parent) return undefined;

  const siblings = parent.namedChildren;
  const nodeIndex = siblings.findIndex((sibling) => sibling.startIndex === node.startIndex);
  if (nodeIndex < 0) return undefined;

  let firstDecorator: Parser.SyntaxNode | undefined;
  for (let index = nodeIndex - 1; index >= 0; index--) {
    const sibling = siblings[index];
    if (sibling.type !== 'decorator') break;
    firstDecorator = sibling;
  }
  return firstDecorator;
}

function findDeclarationTerminator(node: Parser.SyntaxNode): Parser.SyntaxNode | undefined {
  if (node.type !== 'method_signature' && node.type !== 'public_field_definition') {
    return undefined;
  }

  const next = node.nextSibling;
  return next?.type === ';' ? next : undefined;
}

function collectMatches(
  currentNode: Parser.SyntaxNode,
  selectorPath: readonly StructuralSelectorSegment[],
  depth: number,
  results: Array<{ node: Parser.SyntaxNode; discoveryScope: Parser.SyntaxNode }>,
  searchScopes: TreeSitterStructuralSearchScope[],
  source: string,
  parserEvidence: TreeSitterParserEvidence,
): void {
  const segment = selectorPath[depth];
  const isLast = depth === selectorPath.length - 1;
  const candidates: Parser.SyntaxNode[] = [];
  const protectedNodes: Parser.SyntaxNode[] = [];
  const identityUncertainNodes: Parser.SyntaxNode[] = [];
  const traversedNodes: Parser.SyntaxNode[] = [];
  const skippedNodes: Parser.SyntaxNode[] = [];

  function traverse(node: Parser.SyntaxNode): void {
    traversedNodes.push(node);
    for (let index = 0; index < node.namedChildCount; index++) {
      const child = node.namedChild(index);
      if (!child) continue;

      const isKindMatch = isNodeOfKind(child, segment.kind);
      const identityRange = isKindMatch ? getIdentityRange(child, segment.kind, source) : undefined;
      const identityUncertain = Boolean(
        isKindMatch &&
        segment.name &&
        getNodeName(child) !== segment.name &&
        (
          (identityRange !== undefined &&
            hasTreeSitterRecoveryInRange(source, parserEvidence, {
              start: identityRange.startIndex,
              end: identityRange.endIndex,
            })) ||
          (getIdentityNode(child, segment.kind) !== undefined &&
            hasTreeSitterRecoveryAdjacentToNode(parserEvidence, getIdentityNode(child, segment.kind)!))
        ),
      );
      const isMatch =
        isKindMatch &&
        (!segment.name || getNodeName(child) === segment.name || identityUncertain);

      if (isKindMatch && identityUncertain) {
        identityUncertainNodes.push(child);
      } else if (isKindMatch) {
        protectedNodes.push(child);
      }

      if (isMatch) {
        candidates.push(child);
      }

      if (depth > 0 && isStructuralOwner(child)) {
        skippedNodes.push(child);
        continue;
      }

      traverse(child);
    }
  }

  traverse(currentNode);

  searchScopes.push({
    node: currentNode,
    candidateKind: segment.kind,
    protectedNodes,
    traversedNodes,
    skippedNodes,
    discoveryRiskNodes: [
      ...collectTreeSitterDiscoveryRiskNodes(
        parserEvidence,
        traversedNodes,
        skippedNodes,
        segment.kind,
        canHideTypeScriptCandidate,
      ),
      ...parserEvidence.recoveryNodes.filter((recoveryNode) =>
        identityUncertainNodes.some((node) =>
          node.startIndex <= recoveryNode.startIndex && node.endIndex >= recoveryNode.endIndex,
        ),
      ),
    ],
  });

  for (const candidate of candidates) {
    if (isLast) {
      results.push({ node: candidate, discoveryScope: currentNode });
    } else {
      collectMatches(candidate, selectorPath, depth + 1, results, searchScopes, source, parserEvidence);
    }
  }
}

function canHideTypeScriptCandidate(
  recoveryNode: Parser.SyntaxNode,
  candidateKind: StructuralSelectorSegment['kind'],
): boolean {
  const text = recoveryNode.text;
  const keywords = new Map<StructuralSelectorSegment['kind'], RegExp>([
    ['class', /\b(?:class|interface|enum|namespace)\b/],
    ['function', /\bfunction\b|=>/],
    ['if_statement', /\bif\b/],
    ['for_statement', /\bfor\b/],
    ['while_statement', /\bwhile\b/],
    ['switch_statement', /\bswitch\b/],
  ]);
  const keyword = keywords.get(candidateKind);
  if (keyword?.test(text)) return true;

  if (candidateKind === 'function' || candidateKind === 'class') {
    let topLevelRegion: Parser.SyntaxNode = recoveryNode;
    while (topLevelRegion.parent && topLevelRegion.parent.type !== 'program') {
      topLevelRegion = topLevelRegion.parent;
    }

    if (topLevelRegion.parent?.type === 'program') {
      const regionText = topLevelRegion.text.trimStart();

      if (candidateKind === 'class') {
        return /^(?:export\s+(?:default\s+)?)?(?:declare\s+)?(?:abstract\s+)?(?:class|interface|enum|namespace)\b/.test(
          regionText,
        );
      }

      return (
        /^(?:export\s+(?:default\s+)?)?(?:declare\s+)?(?:async\s+)?function\b/.test(regionText) ||
        /^(?:export\s+)?(?:declare\s+)?(?:const|let|var)\s+[A-Za-z_$][A-Za-z0-9_$]*\s*=\s*(?:async\s+)?(?:function\b|\([^)]*\)\s*=>|[A-Za-z_$][A-Za-z0-9_$]*\s*=>)/.test(
          regionText,
        )
      );
    }
  }

  if (candidateKind !== 'method' && candidateKind !== 'constructor') return false;
  const parent = nearestNonRecoveryParent(recoveryNode);
  return parent !== undefined && /^(?:class|interface|enum|module|object)_?body$/.test(parent.type);
}

function nearestNonRecoveryParent(node: Parser.SyntaxNode): Parser.SyntaxNode | undefined {
  let current = node.parent;
  while (current && (current.type === 'ERROR' || current.isMissing())) {
    current = current.parent;
  }
  return current ?? undefined;
}

export function createTypeScriptLanguageAdapter(
  assets: TreeSitterAssetPaths,
): TreeSitterLanguageAdapter {
  return createTreeSitterLanguageAdapter({
    id: 'typescript',
    extensions: TYPESCRIPT_EXTENSIONS,
    supportedKinds: STRUCTURAL_KINDS,
    grammarIdForFile,
    collectCandidates,
  }, assets);
}
