import { StructuralKind, StructuralSelectorSegment } from '@inscribe/shared';
import type { StructuralParserFailure } from '@inscribe/shared';

export { StructuralKind, StructuralSelectorSegment };

export const STRUCTURAL_KINDS: readonly StructuralKind[] = [
  'class',
  'constructor',
  'method',
  'function',
  'for_statement',
  'while_statement',
  'switch_statement',
  'if_statement',
];

/** Flutter semantics layered on top of the Dart Tree-sitter adapter. */
export const FLUTTER_STRUCTURAL_KINDS: readonly StructuralKind[] = [
  'widget',
  'widget_subtree',
  'builder_callback',
  'event_callback',
  'collection_if',
  'collection_for',
  'builder_branch',
];

export const ALL_STRUCTURAL_KINDS: readonly StructuralKind[] = [
  ...STRUCTURAL_KINDS,
  ...FLUTTER_STRUCTURAL_KINDS,
];

export function isStructuralKind(value: unknown): value is StructuralKind {
  return typeof value === 'string' && ALL_STRUCTURAL_KINDS.includes(value as StructuralKind);
}

/**
 * A structural candidate returned by a language adapter.
 *
 * The range is expressed in JavaScript UTF-16 code-unit offsets and follows
 * the usual half-open interval convention: [start, end). Tree-sitter nodes
 * must not cross this boundary.
 */
export interface StructuralCandidate {
  kind: StructuralKind;
  name?: string;
  start: number;
  end: number;
  /**
   * Optional adapter evidence used by the core resolver at the two structural
   * trust boundaries. Uncertain candidates stay in the set so they cannot be
   * silently discarded and turn an ambiguous selector into a unique one.
   */
  reliability?: StructuralCandidateReliability;
}

export type StructuralTrust = 'trustworthy' | 'uncertain';

export interface StructuralCandidateReliability {
  /** Whether the candidate's identity and range can safely qualify a selector. */
  qualification: StructuralTrust;
  /** Whether the candidate's complete range and ownership can safely mutate. */
  replacement: StructuralTrust;
  structuralParser?: StructuralParserFailure;
}

export interface StructuralCandidateDiscovery {
  candidates: readonly StructuralCandidate[];
  /**
   * Parser evidence showing that the candidate set or its cardinality cannot
   * be trusted for this structural query. This is intentionally separate from
   * per-candidate reliability because the uncertainty belongs to the search
   * scope, not to one candidate.
   */
  discoveryUncertainty?: StructuralParserFailure;
}

export type StructuralCandidateResolution =
  | StructuralCandidate[]
  | readonly StructuralCandidate[]
  | StructuralCandidateDiscovery;

export interface StructuralCandidateQuery {
  source: string;
  /** Original path is required so adapters can select grammar variants. */
  filePath: string;
  /** Lowercase extension extracted by the core, including the leading dot. */
  extension: string;
  path: readonly StructuralSelectorSegment[];
}

export interface SyntaxValidationQuery {
  source: string;
  filePath: string;
  /** Lowercase extension extracted by the core, including the leading dot. */
  extension: string;
}

/**
 * Language-specific structural discovery for replace_node.
 *
 * Phase A adapters use Tree-sitter internally. Their public result is
 * deliberately parser-agnostic so selector policy remains in the core.
 */
export interface StructuralCapabilities {
  readonly supportedKinds: readonly StructuralKind[];
  resolveCandidates(
    query: StructuralCandidateQuery,
  ): StructuralCandidateResolution | Promise<StructuralCandidateResolution>;
}

/**
 * Shared language identity plus independently-optional structural capabilities.
 * A syntax-only adapter does not need to expose unused structural members.
 */
export interface LanguageAdapter {
  readonly id: string;
  readonly extensions: readonly string[];
  readonly structural?: StructuralCapabilities;
  /** Optional syntax-only validation for the adapter's supported files. */
  validateSyntax?(query: SyntaxValidationQuery): void | Promise<void>;
}

export interface StructuralLanguageAdapter extends LanguageAdapter {
  readonly structural: StructuralCapabilities;
}

export function hasStructuralCapabilities(
  adapter: LanguageAdapter,
): adapter is StructuralLanguageAdapter {
  return adapter.structural !== undefined;
}

export interface TreeSitterLanguageAdapter extends StructuralLanguageAdapter {
  /** Selects the grammar asset for the concrete file variant being resolved. */
  readonly grammarIdForFile: (filePath: string) => string;
}
