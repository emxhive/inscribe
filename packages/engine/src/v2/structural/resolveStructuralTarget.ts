import * as path from 'path';
import {
  StructuralSelector,
  StructuralNodeMatch,
  isV2StructuralKind,
} from './types';
import { matchesStartsWith } from './startsWithQualifier';
import { V2LanguageRegistry } from '../languages/registry';
import {
  hasV2StructuralCapabilities,
  StructuralCandidate,
  StructuralCandidateDiscovery,
  StructuralCandidateResolution,
  StructuralCandidateReliability,
} from '../languages/types';

export interface ResolveStructuralTargetOptions {
  source: string;
  filePath: string;
  selector: StructuralSelector;
}

export type StructuralResolver = (
  options: ResolveStructuralTargetOptions
) => Promise<StructuralNodeMatch>;

export class StructuralTargetUnreliableError extends Error {
  readonly code = 'STRUCTURAL_TARGET_UNRELIABLE';
  readonly structuralParser?: StructuralCandidateReliability['structuralParser'];

  constructor(reliabilities: readonly StructuralCandidateReliability[]) {
    const first = reliabilities.find((reliability) => reliability.structuralParser);
    const parser = first?.structuralParser;
    const firstDiagnostic = parser?.diagnostics[0];
    const location = firstDiagnostic
      ? ` at line ${firstDiagnostic.startLine}${firstDiagnostic.startColumn > 0 ? `, column ${firstDiagnostic.startColumn + 1}` : ''}`
      : '';
    super(
      `STRUCTURAL_TARGET_UNRELIABLE: Structural parser evidence was not sufficient to safely resolve the requested target${location}. The source was not treated as language-invalid.`,
    );
    this.name = 'StructuralTargetUnreliableError';
    this.structuralParser = parser;
  }
}

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
  const finalName = selector.path[selector.path.length - 1].name;
  for (const candidate of candidates) {
    validateStructuralCandidate(candidate, source.length, finalKind);
  }

  // Adapters may retain a same-kind candidate whose parsed name is uncertain.
  // A trustworthy name mismatch is excluded here, while an uncertain one
  // remains a possible match so recovery cannot invent uniqueness.
  const nameCandidates = finalName
    ? candidates.filter((candidate) =>
      candidate.name === finalName || candidate.reliability?.qualification === 'uncertain',
    )
    : candidates;
  const anyPathMatched = nameCandidates.length > 0;
  let matchedCandidates = nameCandidates;

  if (selector.startsWith) {
    const definitelyMatched = nameCandidates.filter((candidate) => {
      if (candidate.reliability?.qualification === 'uncertain') return false;
      const candidateSource = source.slice(candidate.start, candidate.end);
      return matchesStartsWith(candidateSource, selector.startsWith!);
    });
    const qualificationUncertain = nameCandidates.filter(
      (candidate) => candidate.reliability?.qualification === 'uncertain',
    );

    // An uncertain range cannot be used to prove that a candidate fails the
    // qualifier. Retain it as a possible match so recovery cannot turn an
    // ambiguous or unresolved set into a false unique target.
    matchedCandidates = [...definitelyMatched, ...qualificationUncertain];
  }

  if (matchedCandidates.length === 0) {
    if (anyPathMatched && selector.startsWith) {
      throw new Error('TARGET_QUALIFIER_NOT_MATCHED');
    }
    throw new Error('TARGET_NOT_FOUND');
  }

  const qualificationUncertain = matchedCandidates.filter(
    (candidate) => candidate.reliability?.qualification === 'uncertain',
  );
  if (qualificationUncertain.length > 0) {
    throw new StructuralTargetUnreliableError(
      qualificationUncertain.map((candidate) => candidate.reliability!),
    );
  }

  if (matchedCandidates.length > 1) {
    throw new Error('TARGET_AMBIGUOUS');
  }

  const candidate = matchedCandidates[0];
  if (candidate.reliability?.replacement === 'uncertain') {
    throw new StructuralTargetUnreliableError([candidate.reliability]);
  }
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

    const discovery = await adapter.structural.resolveCandidates({
      source: options.source,
      filePath: options.filePath,
      extension: path.extname(options.filePath).toLowerCase(),
      path: options.selector.path,
    });

    const candidates = normalizeStructuralDiscovery(discovery);
    return selectStructuralCandidate(options.source, options.selector, candidates);
  };
}

function normalizeStructuralDiscovery(
  discovery: StructuralCandidateResolution,
): readonly StructuralCandidate[] {
  if (Array.isArray(discovery)) return discovery;

  const candidateDiscovery = discovery as StructuralCandidateDiscovery;
  if (
    candidateDiscovery.discoveryUncertainty
  ) {
    throw new StructuralTargetUnreliableError([{
      qualification: 'uncertain',
      replacement: 'uncertain',
      structuralParser: candidateDiscovery.discoveryUncertainty,
    }]);
  }
  return candidateDiscovery.candidates;
}
