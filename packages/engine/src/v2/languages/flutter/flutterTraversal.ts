import Parser from 'web-tree-sitter';
import {
  DartStructuralMatch,
  canHideDartCandidate,
  getDartStructuralMatch,
  isDartStructuralOwner,
} from '../dartAdapter';
import {
  StructuralCandidateQuery,
  StructuralSelectorSegment,
} from '../types';
import { FlutterSourceContext } from './flutterContext';
import {
  FlutterStructuralMatch,
  getFlutterStructuralMatch,
} from './flutterMatches';
import type { TreeSitterStructuralSearchScope } from '../treeSitterAdapter';
import {
  collectTreeSitterDiscoveryRiskNodes,
  hasTreeSitterRecoveryAdjacentToNode,
  hasTreeSitterRecoveryInRange,
} from '../../structural/treeSitterParserEvidence';
import type { TreeSitterParserEvidence } from '../../structural/treeSitterParserEvidence';

type StructuralMatch = DartStructuralMatch | FlutterStructuralMatch;

export function collectFlutterMatches(
  currentNode: Parser.SyntaxNode,
  selectorPath: readonly StructuralSelectorSegment[],
  depth: number,
  results: FlutterStructuralMatch[],
  query: StructuralCandidateQuery,
  context: FlutterSourceContext,
  searchScopes: TreeSitterStructuralSearchScope[] = [],
  parserEvidence?: TreeSitterParserEvidence,
): void {
  const segment = selectorPath[depth];
  const isLast = depth === selectorPath.length - 1;
  const candidates: StructuralMatch[] = [];
  const protectedNodes: Parser.SyntaxNode[] = [];
  const identityUncertainNodes: Parser.SyntaxNode[] = [];
  const traversedNodes: Parser.SyntaxNode[] = [];
  const skippedNodes: Parser.SyntaxNode[] = [];

  function traverse(node: Parser.SyntaxNode): void {
    traversedNodes.push(node);
    for (let index = 0; index < node.namedChildCount; index++) {
      const child = node.namedChild(index);
      if (!child) continue;

      const structuralMatch = getStructuralMatch(child, query, segment.kind, context, parserEvidence);
      const identityUncertain = Boolean(
        structuralMatch &&
        segment.name &&
        structuralMatch.name !== segment.name &&
        structuralMatch.identityRange &&
        parserEvidence &&
        (
          hasTreeSitterRecoveryInRange(query.source, parserEvidence, {
            start: structuralMatch.identityRange.startIndex,
            end: structuralMatch.identityRange.endIndex,
          }) ||
          (structuralMatch.identityNode !== undefined &&
            hasTreeSitterRecoveryAdjacentToNode(parserEvidence, structuralMatch.identityNode))
        ),
      );
      if (structuralMatch?.kind === segment.kind && identityUncertain) {
        identityUncertainNodes.push(child);
      } else if (structuralMatch?.kind === segment.kind) {
        protectedNodes.push(child);
      }
      const isMatch =
        structuralMatch?.kind === segment.kind &&
        (!segment.name || structuralMatch.name === segment.name || identityUncertain);

      if (isMatch) candidates.push(structuralMatch);

      if (
        depth > 0 &&
        (isDartStructuralOwner(child) || isOwnedFunctionBody(child)) &&
        structuralMatch?.kind !== segment.kind
      ) {
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
    discoveryRiskNodes: parserEvidence
      ? [
        ...collectTreeSitterDiscoveryRiskNodes(
          parserEvidence,
          traversedNodes,
          skippedNodes,
          segment.kind,
          canHideFlutterCandidate,
        ),
        ...parserEvidence.recoveryNodes.filter((recoveryNode) =>
          identityUncertainNodes.some((node) =>
            node.startIndex <= recoveryNode.startIndex && node.endIndex >= recoveryNode.endIndex,
          ),
        ),
      ]
      : [],
  });

  for (const candidate of candidates) {
    if (isLast) {
      results.push({
        ...(candidate as FlutterStructuralMatch),
        discoveryScope: currentNode,
      });
    } else {
      collectFlutterMatches(
        candidate.traversalNode,
        selectorPath,
        depth + 1,
        results,
        query,
        context,
        searchScopes,
        parserEvidence,
      );
    }
  }
}

function canHideFlutterCandidate(
  recoveryNode: Parser.SyntaxNode,
  candidateKind: StructuralSelectorSegment['kind'],
): boolean {
  if (
    candidateKind === 'class' ||
    candidateKind === 'function' ||
    candidateKind === 'method' ||
    candidateKind === 'constructor' ||
    candidateKind === 'if_statement' ||
    candidateKind === 'for_statement' ||
    candidateKind === 'while_statement' ||
    candidateKind === 'switch_statement'
  ) {
    return canHideDartCandidate(recoveryNode, candidateKind);
  }

  const text = recoveryNode.text;
  if (candidateKind === 'collection_if' || candidateKind === 'builder_branch') return /\bif\b/.test(text);
  if (candidateKind === 'collection_for') return /\bfor\b/.test(text);
  if (candidateKind === 'builder_callback' || candidateKind === 'event_callback') {
    return /\b(?:builder|on[A-Z])\w*\b|=>/.test(text) || recoveryNode.parent?.type === 'named_argument';
  }
  if (candidateKind === 'widget') {
    if (/\bclass\b/.test(text)) return true;

    let owner: Parser.SyntaxNode | null = recoveryNode.parent;
    while (owner && owner.type !== 'class_definition') owner = owner.parent;
    if (!owner) return false;

    const body = owner.childForFieldName('body');
    return !body || recoveryNode.endIndex <= body.startIndex;
  }
  if (candidateKind === 'widget_subtree') return /\bconst\b|[A-Z][A-Za-z0-9_$]*\s*\(/.test(text);
  return false;
}

function getStructuralMatch(
  node: Parser.SyntaxNode,
  query: StructuralCandidateQuery,
  requestedKind: StructuralSelectorSegment['kind'],
  context: FlutterSourceContext,
  parserEvidence?: TreeSitterParserEvidence,
): StructuralMatch | undefined {
  if (requestedKind === 'widget' ||
      requestedKind === 'widget_subtree' ||
      requestedKind === 'builder_callback' ||
      requestedKind === 'event_callback' ||
      requestedKind === 'collection_if' ||
      requestedKind === 'collection_for' ||
      requestedKind === 'builder_branch') {
    return getFlutterStructuralMatch(node, query.source, requestedKind, context, parserEvidence);
  }
  return getDartStructuralMatch(node, query.source, requestedKind);
}

function isOwnedFunctionBody(node: Parser.SyntaxNode): boolean {
  if (node.type !== 'function_body') return false;
  const preceding = getPrecedingNamedSibling(node);
  return preceding ? isDartStructuralOwner(preceding) : false;
}

function getPrecedingNamedSibling(
  node: Parser.SyntaxNode,
): Parser.SyntaxNode | undefined {
  const parent = node.parent;
  if (!parent) return undefined;

  for (let index = 1; index < parent.namedChildCount; index++) {
    if (parent.namedChild(index)?.startIndex === node.startIndex) {
      return parent.namedChild(index - 1) ?? undefined;
    }
  }
  return undefined;
}
