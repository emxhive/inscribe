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
}
