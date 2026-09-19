import { StructuralKind, StructuralSelectorSegment } from '@inscribe/shared';

export { StructuralKind, StructuralSelectorSegment };

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

export interface SyntaxValidationQuery {
  source: string;
  filePath: string;
  /** Lowercase extension extracted by the V2 core, including the leading dot. */
  extension: string;
}

/**
 * Language-specific structural discovery for V2 replace_node.
 *
 * Phase A adapters use Tree-sitter internally. Their public result is
 * deliberately parser-agnostic so selector policy remains in the V2 core.
 */
export interface V2StructuralCapabilities {
  readonly supportedKinds: readonly StructuralKind[];
  resolveCandidates(
    query: StructuralCandidateQuery,
  ): StructuralCandidate[] | readonly StructuralCandidate[] | Promise<StructuralCandidate[] | readonly StructuralCandidate[]>;
}

/**
 * Shared language identity plus independently-optional V2 capabilities.
 * A syntax-only adapter does not need to expose unused structural members.
 */
export interface V2LanguageAdapter {
  readonly id: string;
  readonly extensions: readonly string[];
  readonly structural?: V2StructuralCapabilities;
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
