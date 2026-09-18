import type {
  StructuralKind,
  StructuralRange,
  StructuralSelectorSegment,
} from '@inscribe/shared';
import type { V2ValidationResult } from '../validators';

/**
 * Parser-agnostic structural match returned by a V2 language adapter.
 *
 * Ranges use JavaScript UTF-16 string offsets and are half-open: [start, end).
 * They always refer to the exact source string supplied to findCandidates().
 */
export interface StructuralCandidate {
  kind: StructuralKind;
  name?: string;
  range: StructuralRange;
}

export interface FindStructuralCandidatesInput {
  source: string;
  filePath: string;
  path: readonly StructuralSelectorSegment[];
}

export interface V2StructuralCapability {
  supportedKinds: ReadonlySet<StructuralKind>;
  findCandidates(input: FindStructuralCandidatesInput): Promise<StructuralCandidate[]>;
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
  id: string;
  extensions: readonly string[];
  structural?: V2StructuralCapability;
  validation?: V2LanguageValidationCapability;
}
