export type V2ProtocolErrorCode =
  | 'NO_INSCRIBE_BLOCKS'
  | 'UNTERMINATED_INSCRIBE_BLOCK'
  | 'UNKNOWN_DIRECTIVE'
  | 'DUPLICATE_DIRECTIVE'
  | 'UNKNOWN_SECTION'
  | 'DUPLICATE_SECTION'
  | 'MISSING_REQUIRED_FIELD'
  | 'FORBIDDEN_FIELD'
  | 'INVALID_MODE'
  | 'INVALID_FILE_PATH'
  | 'EMPTY_SELECTOR'
  | 'EMPTY_SEARCH'
  | 'EMPTY_STARTS_WITH'
  | 'EMPTY_CONTENT'
  | 'INVALID_SELECTOR'
  | 'UNTERMINATED_SECTION'
  | 'UNEXPECTED_CONTENT'
  | 'MALFORMED_MARKER'
  | 'MALFORMED_WRAPPER_FENCE';

export class V2ProtocolError extends Error {
  constructor(
    public code: V2ProtocolErrorCode,
    public blockIndex: number,
    public line: number,
    public context?: string
  ) {
    super(`[Block ${blockIndex}, Line ${line}] ${code}: ${context || ''}`);
    this.name = 'V2ProtocolError';
    Object.setPrototypeOf(this, V2ProtocolError.prototype);
  }
}
