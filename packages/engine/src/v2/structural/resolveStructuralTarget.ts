import * as path from 'path';
import {
  StructuralSelector,
  StructuralNodeMatch,
  isV2StructuralKind,
} from './types';
import { matchesStartsWith } from './startsWithQualifier';
import { V2LanguageRegistry } from '../languages/registry';
import { hasV2StructuralCapabilities, StructuralCandidate } from '../languages/types';

export interface ResolveStructuralTargetOptions {
  source: string;
  filePath: string;
  selector: StructuralSelector;
}

export type StructuralResolver = (
  options: ResolveStructuralTargetOptions
) => Promise<StructuralNodeMatch>;

export function validateStructuralSelector(selector: StructuralSelector): void {
  if (!selector || !Array.isArray(selector.path) || selector.path.length === 0) {
    throw new Error('INVALID_SELECTOR');
  }

  if (
    selector.startsWith !== undefined &&
    (typeof selector.startsWith !== 'string' || selector.startsWith.trim() === '')
  ) {
    throw new Error('INVALID_SELECTOR');
  }

  for (const segment of selector.path) {
    if (!segment || !isV2StructuralKind(segment.kind)) {
      throw new Error('INVALID_SELECTOR');
    }
    if (
      segment.name !== undefined &&
      (typeof segment.name !== 'string' || segment.name.trim() === '')
    ) {
      throw new Error('INVALID_SELECTOR');
    }
  }
}

function validateStructuralCandidate(
  candidate: StructuralCandidate,
  sourceLength: number,
  finalKind: StructuralSelector['path'][number]['kind'],
): void {
  if (
    !candidate ||
    !isV2StructuralKind(candidate.kind) ||
    !Number.isInteger(candidate.start) ||
    !Number.isInteger(candidate.end) ||
    candidate.start < 0 ||
    candidate.start >= candidate.end ||
    candidate.end > sourceLength
  ) {
    throw new Error('INVALID_STRUCTURAL_CANDIDATE');
  }
  if (candidate.kind !== finalKind) {
    throw new Error(
      `STRUCTURAL_CANDIDATE_KIND_MISMATCH: expected ${finalKind}, received ${candidate.kind}`,
    );
  }
}

/**
 * Applies V2 selector policy to language-neutral candidates. Adapters only
 * discover candidates; STARTS_WITH, not-found, ambiguity, and winner choice
 * remain owned by this core function.
 */
export function selectStructuralCandidate(
  source: string,
  selector: StructuralSelector,
  candidates: readonly StructuralCandidate[],
): StructuralNodeMatch {
  validateStructuralSelector(selector);
  const finalKind = selector.path[selector.path.length - 1].kind;
  for (const candidate of candidates) {
    validateStructuralCandidate(candidate, source.length, finalKind);
  }

  const anyPathMatched = candidates.length > 0;
  let matchedCandidates = candidates;

  if (selector.startsWith) {
    matchedCandidates = candidates.filter((candidate) => {
      const candidateSource = source.slice(candidate.start, candidate.end);
      return matchesStartsWith(candidateSource, selector.startsWith!);
    });
  }

  if (matchedCandidates.length === 0) {
    if (anyPathMatched && selector.startsWith) {
      throw new Error('TARGET_QUALIFIER_NOT_MATCHED');
    }
    throw new Error('TARGET_NOT_FOUND');
  }

  if (matchedCandidates.length > 1) {
    throw new Error('TARGET_AMBIGUOUS');
  }

  const candidate = matchedCandidates[0];
  return {
    kind: candidate.kind,
    name: candidate.name,
    start: candidate.start,
    end: candidate.end,
  };
}

/**
 * Creates the adapter-backed resolver used by V2 replace_node.
 */
export function createAdapterStructuralResolver(
  registry: V2LanguageRegistry,
): StructuralResolver {
  return async (options): Promise<StructuralNodeMatch> => {
    validateStructuralSelector(options.selector);
    const adapter = registry.resolve(options.filePath);
    if (!adapter || !hasV2StructuralCapabilities(adapter)) {
      throw new Error('UNSUPPORTED_EXTENSION');
    }

    const unsupportedSegment = options.selector.path.find(
      (segment) => !adapter.structural.supportedKinds.includes(segment.kind),
    );
    if (unsupportedSegment) {
      throw new Error(`UNSUPPORTED_STRUCTURAL_KIND: ${unsupportedSegment.kind}`);
    }

    const candidates = await adapter.structural.resolveCandidates({
      source: options.source,
      filePath: options.filePath,
      extension: path.extname(options.filePath).toLowerCase(),
      path: options.selector.path,
    });
    return selectStructuralCandidate(options.source, options.selector, candidates);
  };
}
