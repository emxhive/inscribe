import Parser from 'web-tree-sitter';
import type { StructuralCandidateReliability, StructuralTrust } from './types';
import type {
  TreeSitterReplacementCandidate,
  TreeSitterStructuralSearchScope,
} from './treeSitterAdapter';
import {
  createTreeSitterParserFailure,
  createTreeSitterRecoveryDiagnostic,
  hasTreeSitterRecoveryAdjacentToNode,
} from '../structural/treeSitterParserEvidence';
import type {
  TreeSitterParserEvidence,
} from '../structural/treeSitterParserEvidence';
import type { V2StructuralParserFailure } from '@inscribe/shared';
import {
  treeSitterByteRangeToJsRange,
  treeSitterRangeToJsRange,
} from '../structural/treeSitterRangeToJsRange';

interface JsRange {
  start: number;
  end: number;
}

/**
 * Interprets Tree-sitter evidence for the generic candidate trust contract.
 * This function knows recovery-node mechanics, but not selector policy.
 */
export function assessTreeSitterCandidateReliability(
  source: string,
  adapterId: string,
  grammarId: string,
  candidate: TreeSitterReplacementCandidate,
  replacementRange: JsRange,
  evidence: TreeSitterParserEvidence,
): StructuralCandidateReliability | undefined {
  const replacementNode = candidate.replacement.type === 'node'
    ? candidate.replacement.node
    : undefined;
  const reliabilityNode = candidate.reliabilityNode ?? replacementNode;
  const identityRange = candidate.identityRange
    ? candidate.identityRange.coordinateSpace === 'js-utf16'
      ? { start: candidate.identityRange.startIndex, end: candidate.identityRange.endIndex }
      : treeSitterByteRangeToJsRange(source, candidate.identityRange)
    : undefined;
  const identityDiagnostics = identityRange
    ? evidence.diagnostics.filter((diagnostic) =>
      rangesOverlap(diagnostic.startIndex, diagnostic.endIndex, identityRange.start, identityRange.end),
    )
    : [];
  const boundaryDiagnostics = evidence.diagnostics.filter((diagnostic) =>
    diagnosticTouchesBoundary(diagnostic.startIndex, diagnostic.endIndex, replacementRange),
  );
  const identityAdjacentRecovery = candidate.identityNode
    ? hasTreeSitterRecoveryAdjacentToNode(evidence, candidate.identityNode)
    : false;

  let qualification: StructuralTrust = 'trustworthy';
  let replacement: StructuralTrust = 'trustworthy';
  let failureDiagnostics: TreeSitterParserEvidence['diagnostics'] = boundaryDiagnostics;
  let fallbackNode: Parser.SyntaxNode | undefined;

  if (!reliabilityNode && evidence.diagnostics.length > 0) {
    qualification = 'uncertain';
    replacement = 'uncertain';
    failureDiagnostics = evidence.diagnostics;
  }

  if (reliabilityNode) {
    const reliabilityRange = treeSitterRangeToJsRange(source, reliabilityNode);
    if (reliabilityRange.start < replacementRange.start || reliabilityRange.end > replacementRange.end) {
      qualification = 'uncertain';
      replacement = 'uncertain';
      failureDiagnostics = evidence.diagnostics;
      fallbackNode = reliabilityNode;
    }

    if (
      reliabilityNode.type === 'ERROR' ||
      reliabilityNode.isMissing() ||
      hasErrorAncestor(reliabilityNode)
    ) {
      qualification = 'uncertain';
      replacement = 'uncertain';
      failureDiagnostics = boundaryDiagnostics;
      fallbackNode = reliabilityNode;
    }

    const touchingSibling = [reliabilityNode.previousSibling, reliabilityNode.nextSibling]
      .find((sibling) => sibling && isRecoveryNode(sibling));
    if (touchingSibling) {
      qualification = 'uncertain';
      replacement = 'uncertain';
      failureDiagnostics = boundaryDiagnostics;
      if (failureDiagnostics.length === 0) {
        failureDiagnostics = [createTreeSitterRecoveryDiagnostic(source, touchingSibling)];
      }
      fallbackNode = touchingSibling;
    }
  }

  // Identity and replacement-boundary evidence are separate facts. Recovery
  // in a body does not make an otherwise clear outer replacement unsafe.
  if (identityDiagnostics.length > 0 || identityAdjacentRecovery || boundaryDiagnostics.length > 0) {
    qualification = 'uncertain';
  }
  if (boundaryDiagnostics.length > 0) replacement = 'uncertain';
  if (identityDiagnostics.length > 0 && failureDiagnostics.length === 0) {
    failureDiagnostics = identityDiagnostics;
  }
  if (identityAdjacentRecovery && failureDiagnostics.length === 0 && candidate.identityNode) {
    const adjacentRecovery = [candidate.identityNode.previousSibling, candidate.identityNode.nextSibling]
      .find((sibling) => sibling && isRecoveryNode(sibling));
    if (adjacentRecovery) {
      failureDiagnostics = [createTreeSitterRecoveryDiagnostic(source, adjacentRecovery)];
    }
  }

  if (qualification === 'trustworthy' && replacement === 'trustworthy') return undefined;

  if (failureDiagnostics.length === 0 && fallbackNode) {
    failureDiagnostics = [createTreeSitterRecoveryDiagnostic(source, fallbackNode)];
  }

  return {
    qualification,
    replacement,
    structuralParser: createTreeSitterParserFailure(
      adapterId,
      grammarId,
      failureDiagnostics.length > 0 ? failureDiagnostics : evidence.diagnostics,
      evidence.totalDiagnostics,
    ),
  };
}

/**
 * Determines whether the language adapter identified recovery that can hide
 * another candidate in the exact traversal it performed. The policy consumes
 * that structural evidence; it does not infer candidate risk from arbitrary
 * diagnostic containment.
 */
export function assessTreeSitterDiscoveryReliability(
  source: string,
  adapterId: string,
  grammarId: string,
  searchScopes: readonly TreeSitterStructuralSearchScope[],
  evidence: TreeSitterParserEvidence,
  discoveryComplete: boolean,
): V2StructuralParserFailure | undefined {
  if (evidence.recoveryNodes.length === 0) return undefined;

  const uniqueScopes = searchScopes.filter((scope, index) =>
    searchScopes.findIndex((other) =>
      isSameNode(other.node, scope.node) && other.candidateKind === scope.candidateKind,
    ) === index,
  );
  if (uniqueScopes.length === 0 && !discoveryComplete) {
    return createTreeSitterParserFailure(
      adapterId,
      grammarId,
      evidence.diagnostics,
      evidence.totalDiagnostics,
    );
  }

  const unresolvedRecoveryNodes: Parser.SyntaxNode[] = [];
  for (const scope of uniqueScopes) {
    for (const recoveryNode of scope.discoveryRiskNodes) {
      if (!isWithinActualTraversal(recoveryNode, scope)) continue;
      const recoveryIsInsideProtectedNode = scope.protectedNodes.some((node) =>
        isDescendantOrSelf(recoveryNode, node),
      );
      if (!recoveryIsInsideProtectedNode) {
        unresolvedRecoveryNodes.push(recoveryNode);
      }
    }
  }

  if (unresolvedRecoveryNodes.length === 0) return undefined;

  const diagnostics = evidence.diagnostics.filter((diagnostic) =>
    unresolvedRecoveryNodes.some((node) => {
      const nodeRange = treeSitterRangeToJsRange(source, node);
      return rangesOverlapOrTouch(
        diagnostic.startIndex,
        diagnostic.endIndex,
        nodeRange.start,
        nodeRange.end,
      );
    }),
  );
  const fallbackDiagnostics = diagnostics.length > 0
    ? diagnostics
    : unresolvedRecoveryNodes.map((node) => createTreeSitterRecoveryDiagnostic(source, node));

  return createTreeSitterParserFailure(
    adapterId,
    grammarId,
    fallbackDiagnostics,
    evidence.totalDiagnostics,
  );
}

function hasErrorAncestor(node: Parser.SyntaxNode): boolean {
  let current = node.parent;
  while (current) {
    if (isRecoveryNode(current)) return true;
    current = current.parent;
  }
  return false;
}

function isRecoveryNode(node: Parser.SyntaxNode): boolean {
  return node.type === 'ERROR' || node.isMissing();
}

function rangesOverlapOrTouch(
  firstStart: number,
  firstEnd: number,
  secondStart: number,
  secondEnd: number,
): boolean {
  return firstStart <= secondEnd && firstEnd >= secondStart;
}

function rangesOverlap(
  firstStart: number,
  firstEnd: number,
  secondStart: number,
  secondEnd: number,
): boolean {
  if (firstStart === firstEnd) return firstStart >= secondStart && firstStart < secondEnd;
  if (secondStart === secondEnd) return secondStart >= firstStart && secondStart < firstEnd;
  return firstStart < secondEnd && firstEnd > secondStart;
}

function isWithinActualTraversal(
  recoveryNode: Parser.SyntaxNode,
  scope: TreeSitterStructuralSearchScope,
): boolean {
  let current: Parser.SyntaxNode | null = recoveryNode;
  while (current) {
    const currentNode: Parser.SyntaxNode = current;
    if (scope.skippedNodes.some((node) => isSameNode(currentNode, node))) return false;
    if (scope.traversedNodes.some((node) => isSameNode(currentNode, node))) return true;
    current = currentNode.parent;
  }
  return false;
}

function isDescendantOrSelf(node: Parser.SyntaxNode, ancestor: Parser.SyntaxNode): boolean {
  let current: Parser.SyntaxNode | null = node;
  while (current) {
    if (isSameNode(current, ancestor)) return true;
    current = current.parent;
  }
  return false;
}

function isSameNode(first: Parser.SyntaxNode, second: Parser.SyntaxNode): boolean {
  return (
    first.type === second.type &&
    first.startIndex === second.startIndex &&
    first.endIndex === second.endIndex
  );
}

function diagnosticTouchesBoundary(start: number, end: number, range: JsRange): boolean {
  return (
    (start <= range.start && end >= range.start) ||
    (start <= range.end && end >= range.end)
  );
}
