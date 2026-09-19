import type {
  StructuralKind,
  StructuralRange,
  StructuralSelectorSegment,
} from '@inscribe/shared';
import type { V2ValidationResult } from '../validators';

export type { StructuralKind, StructuralSelectorSegment };

export const V2_STRUCTURAL_KINDS: readonly StructuralKind[] = [
  'class',
  'constructor',
  'method',
  'function',
  'for_statement',
  'while_statement',
  'switch_statement',
  'if_statement',
];

export function isV2StructuralKind(value: unknown): value is StructuralKind {
  return typeof value === 'string' && V2_STRUCTURAL_KINDS.includes(value as StructuralKind);
}

/**
 * Parser-agnostic structural match returned by a V2 language adapter.
 *
 * Ranges use JavaScript UTF-16 string offsets and are half-open: [start, end).
 * They always refer to the exact source string supplied to findCandidates().
 */
 */
export interface StructuralCandidate {
  kind: StructuralKind;
  name?: string;
export interface StructuralCandidate {
  kind: StructuralKind;
  name?: string;
  range: StructuralRange;
}

export interface StructuralCandidateQuery {
  source: string;
  /** Original path is required so adapters can select grammar variants. */
  filePath: string;
  /** Lowercase extension extracted by the V2 core, including the leading dot. */
  extension: string;
  path: readonly StructuralSelectorSegment[];
}

export interface SyntaxValidationQuery {
  source: string;
  filePath: string;
  /** Lowercase extension extracted by the V2 core, including the leading dot. */
  extension: string;
}

export interface V2StructuralCapabilities {
  readonly supportedKinds: readonly StructuralKind[];
  resolveCandidates(
    query: StructuralCandidateQuery,
  ): StructuralCandidate[] | readonly StructuralCandidate[] | Promise<StructuralCandidate[] | readonly StructuralCandidate[]>;
}

export interface V2CandidateValidationInput {
  filePath: string;
  source: string;
}

export interface V2LanguageValidationCapability {
  validateCandidate(input: V2CandidateValidationInput): Promise<V2ValidationResult>;
}

/**
 * A V2 language adapter describes language behavior only.
 * Runtime assets and parser deployment details are supplied when adapters are
 * constructed and must not leak through this contract.
 */
export interface V2LanguageAdapter {
  readonly id: string;
  readonly extensions: readonly string[];
  readonly structural?: V2StructuralCapabilities;
  readonly validation?: V2LanguageValidationCapability;
  /** Optional syntax-only validation for the adapter's supported files. */
  validateSyntax?(query: SyntaxValidationQuery): void | Promise<void>;
}

export interface V2StructuralLanguageAdapter extends V2LanguageAdapter {
  readonly structural: V2StructuralCapabilities;
}

export function hasV2StructuralCapabilities(
  adapter: V2LanguageAdapter,
): adapter is V2StructuralLanguageAdapter {
  return adapter.structural !== undefined;
}

export interface TreeSitterLanguageAdapter extends V2StructuralLanguageAdapter {
  /** Selects the grammar asset for the concrete file variant being resolved. */
  readonly grammarIdForFile: (filePath: string) => string;
  readonly validateSyntax: (query: SyntaxValidationQuery) => Promise<void>;
}
}
