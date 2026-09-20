import Parser from 'web-tree-sitter';
import type { StructuralCandidateReliability, StructuralTrust } from './types';
import type { TreeSitterReplacementCandidate } from './treeSitterAdapter';
import {
  createTreeSitterParserFailure,
} from '../structural/treeSitterParserEvidence';
import type {
  TreeSitterParserEvidence,
} from '../structural/treeSitterParserEvidence';
import type { StructuralParserFailure } from '@inscribe/shared';
import { treeSitterRangeToJsRange } from '../structural/treeSitterRangeToJsRange';

interface JsRange {
  start: number;
  end: number;
}

/**
 * Checks the adapter's concrete structural relationship. Parser recovery is
 * diagnostic only; it is not a reason to distrust an otherwise concrete
 * identity or replacement range.
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
  if (!reliabilityNode) return undefined;

  const reliabilityRange = treeSitterRangeToJsRange(source, reliabilityNode);
  if (reliabilityRange.start >= replacementRange.start && reliabilityRange.end <= replacementRange.end) {
    return undefined;
  }

  return {
    qualification: 'uncertain',
    replacement: 'uncertain',
    structuralParser: createTreeSitterParserFailure(
      adapterId,
      grammarId,
      evidence.diagnostics,
      evidence.totalDiagnostics,
    ),
  };
}
