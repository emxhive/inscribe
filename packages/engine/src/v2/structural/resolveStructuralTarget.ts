import * as path from "path";
import {
  StructuralSelector,
  StructuralNodeMatch,
  isStructuralKind,
} from "./types";
import { matchesStartsWith } from "./startsWithQualifier";
import { LanguageRegistry } from "../languages/registry";
import {
  hasStructuralCapabilities,
  StructuralCandidate,
  StructuralCandidateReliability,
} from "../languages/types";

export interface ResolveStructuralTargetOptions {
  source: string;
  filePath: string;
  selector: StructuralSelector;
}

export type StructuralResolver = (
  options: ResolveStructuralTargetOptions,
) => Promise<StructuralNodeMatch>;

export class StructuralTargetUnreliableError extends Error {
  readonly code = "STRUCTURAL_TARGET_UNRELIABLE";
  readonly structuralParser?: StructuralCandidateReliability["structuralParser"];

  constructor(reliabilities: readonly StructuralCandidateReliability[]) {
    const first = reliabilities.find(
      (reliability) => reliability.structuralParser,
    );
    const parser = first?.structuralParser;
    const firstDiagnostic = parser?.diagnostics[0];
    const location = firstDiagnostic
      ? ` at line ${firstDiagnostic.startLine}${firstDiagnostic.startColumn > 0 ? `, column ${firstDiagnostic.startColumn + 1}` : ""}`
      : "";
    super(
      `STRUCTURAL_TARGET_UNRELIABLE: Structural adapter evidence was not sufficient to safely resolve the requested target${location}. The source was not treated as language-invalid.`,
    );
    this.name = "StructuralTargetUnreliableError";
    this.structuralParser = parser;
  }
}

export function validateStructuralSelector(selector: StructuralSelector): void {
  if (
    !selector ||
    !Array.isArray(selector.path) ||
    selector.path.length === 0
  ) {
    throw new Error("INVALID_SELECTOR");
  }

  if (
    selector.startsWith !== undefined &&
    (typeof selector.startsWith !== "string" ||
      selector.startsWith.trim() === "")
  ) {
    throw new Error("INVALID_SELECTOR");
  }

  for (const segment of selector.path) {
    if (!segment || !isStructuralKind(segment.kind)) {
      throw new Error("INVALID_SELECTOR");
    }
    if (
      segment.name !== undefined &&
      (typeof segment.name !== "string" || segment.name.trim() === "")
    ) {
      throw new Error("INVALID_SELECTOR");
    }
  }
}

function validateStructuralCandidate(
  candidate: StructuralCandidate,
  sourceLength: number,
  finalKind: StructuralSelector["path"][number]["kind"],
): void {
  if (
    !candidate ||
    !isStructuralKind(candidate.kind) ||
    !Number.isInteger(candidate.start) ||
    !Number.isInteger(candidate.end) ||
    candidate.start < 0 ||
    candidate.start >= candidate.end ||
    candidate.end > sourceLength
  ) {
    throw new Error("INVALID_STRUCTURAL_CANDIDATE");
  }
  if (candidate.kind !== finalKind) {
    throw new Error(
      `STRUCTURAL_CANDIDATE_KIND_MISMATCH: expected ${finalKind}, received ${candidate.kind}`,
    );
  }
}

/**
 * Applies selector policy to language-neutral candidates. Adapters only
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

  // A known identity mismatch is excluded here, while an indeterminate
  // qualification remains possible so it cannot create false uniqueness.
  const nameCandidates = finalName
    ? candidates.filter(
        (candidate) =>
          candidate.name === finalName ||
          candidate.reliability?.qualification === "uncertain",
      )
    : candidates;
  const anyPathMatched = nameCandidates.length > 0;
  let matchedCandidates = nameCandidates;

  if (selector.startsWith) {
    const definitelyMatched = nameCandidates.filter((candidate) => {
      if (candidate.reliability?.qualification === "uncertain") return false;
      const candidateSource = source.slice(candidate.start, candidate.end);
      return matchesStartsWith(candidateSource, selector.startsWith!);
    });
    const qualificationUncertain = nameCandidates.filter(
      (candidate) => candidate.reliability?.qualification === "uncertain",
    );

    // An indeterminate qualifier result cannot prove that a candidate fails.
    // Retain it as a possible match so uncertainty cannot create false
    // uniqueness.
    matchedCandidates = [...definitelyMatched, ...qualificationUncertain];
  }

  if (matchedCandidates.length === 0) {
    if (anyPathMatched && selector.startsWith) {
      throw new Error("TARGET_QUALIFIER_NOT_MATCHED");
    }
    throw new Error("TARGET_NOT_FOUND");
  }

  const qualificationUncertain = matchedCandidates.filter(
    (candidate) => candidate.reliability?.qualification === "uncertain",
  );
  if (qualificationUncertain.length > 0) {
    throw new StructuralTargetUnreliableError(
      qualificationUncertain.map((candidate) => candidate.reliability!),
    );
  }

  if (matchedCandidates.length > 1) {
    throw new Error("TARGET_AMBIGUOUS");
  }

  const candidate = matchedCandidates[0];
  if (candidate.reliability?.replacement === "uncertain") {
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
 * Creates the adapter-backed resolver used by replace_node.
 */
export function createAdapterStructuralResolver(
  registry: LanguageRegistry,
): StructuralResolver {
  return async (options): Promise<StructuralNodeMatch> => {
    validateStructuralSelector(options.selector);
    const adapter = registry.resolve(options.filePath);
    if (!adapter || !hasStructuralCapabilities(adapter)) {
      throw new Error("UNSUPPORTED_EXTENSION");
    }

    const unsupportedSegment = options.selector.path.find(
      (segment) => !adapter.structural.supportedKinds.includes(segment.kind),
    );
    if (unsupportedSegment) {
      throw new Error(
        `UNSUPPORTED_STRUCTURAL_KIND: ${unsupportedSegment.kind}`,
      );
    }

    const candidates = await adapter.structural.resolveCandidates({
      source: options.source,
      filePath: options.filePath,
      extension: path.extname(options.filePath).toLowerCase(),
      path: options.selector.path,
    });

    return selectStructuralCandidate(
      options.source,
      options.selector,
      candidates,
    );
  };
}
