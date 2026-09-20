export type PreviewV2ErrorType = 'protocol' | 'workspace' | 'resolution' | 'system';
export type PreviewV2DiagnosticLocation = 'exact' | 'block' | 'uncertain';

/**
 * Serializable V2 preview diagnostic shared by the engine, IPC boundary, and
 * renderer state. Dependency-blocked diagnostics identify the source step
 * that made a later same-file operation non-applyable.
 */
export interface PreviewV2ErrorDTO {
  type: PreviewV2ErrorType;
  code: string;
  message: string;
  filePath?: string;
  strategy?: string;
  operationIndex?: number;
  blockIndex?: number;
  line?: number;
  lineKind?: PreviewV2DiagnosticLocation;
  context?: string;
  blockedByOperationIndex?: number;
  blockedByBlockIndex?: number;
  structuralParser?: V2StructuralParserFailure;
}

/**
 * A parser diagnostic retained for structural-target safety decisions.
 * Indices are JavaScript UTF-16 offsets; lines are one-based and columns are
 * zero-based to match the source location conventions used by the renderer.
 */
export interface V2StructuralParserDiagnostic {
  condition: 'ERROR_NODE' | 'MISSING_NODE';
  nodeType: string;
  startIndex: number;
  endIndex: number;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
  context: string;
}

/**
 * Parser diagnostics that made a structural target unsafe to replace.
 * This is deliberately distinct from an authoritative language-validation
 * failure: Tree-sitter is reporting structural uncertainty, not source
 * invalidity according to the language.
 */
export interface V2StructuralParserFailure {
  parser: 'tree-sitter';
  adapterId: string;
  grammarId: string;
  diagnostics: V2StructuralParserDiagnostic[];
  totalDiagnostics?: number;
  diagnosticsTruncated?: boolean;
}
