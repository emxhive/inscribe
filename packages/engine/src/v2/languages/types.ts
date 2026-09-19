import { StructuralKind, StructuralSelectorSegment } from '@inscribe/shared';

export { StructuralKind, StructuralSelectorSegment };

export const V2_STRUCTURAL_KINDS: readonly StructuralKind[] = [
  'class',
  'method',
  'function',
  'if_statement',
];

export function isV2StructuralKind(value: unknown): value is StructuralKind {
  return typeof value === 'string' && V2_STRUCTURAL_KINDS.includes(value as StructuralKind);
}

/**
 * A structural candidate returned by a V2 language adapter.
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
}

export interface StructuralCandidateQuery {
  source: string;
  /** Original path is required so adapters can select grammar variants. */
  filePath: string;
  /** Lowercase extension extracted by the V2 core, including the leading dot. */
  extension: string;
  path: readonly StructuralSelectorSegment[];
}

/**
 * Language-specific structural discovery for V2 replace_node.
 *
 * Phase A adapters use Tree-sitter internally. Their public result is
 * deliberately parser-agnostic so selector policy remains in the V2 core.
 */
export interface V2LanguageAdapter {
  readonly id: string;
  readonly extensions: readonly string[];
  readonly supportedKinds: readonly StructuralKind[];
  resolveCandidates(
    query: StructuralCandidateQuery,
  ): StructuralCandidate[] | readonly StructuralCandidate[] | Promise<StructuralCandidate[] | readonly StructuralCandidate[]>;
}

export interface TreeSitterLanguageAdapter extends V2LanguageAdapter {
  /** Selects the grammar asset for the concrete file variant being resolved. */
  readonly grammarIdForFile: (filePath: string) => string;
}
