export const DIAGNOSTIC_CODES = {
  INVALID_MODE: 'INVALID_MODE',
  INVALID_DIRECTIVE: 'INVALID_DIRECTIVE',
  MISSING_DIRECTIVE: 'MISSING_DIRECTIVE',
  CONTENT_REQUIRED: 'CONTENT_REQUIRED',
  CONTENT_FORBIDDEN: 'CONTENT_FORBIDDEN',
  EMPTY_CONTENT_NOT_ALLOWED: 'EMPTY_CONTENT_NOT_ALLOWED',
  FILE_MUST_EXIST: 'FILE_MUST_EXIST',
  FILE_MUST_NOT_EXIST: 'FILE_MUST_NOT_EXIST',
} as const;

export type DiagnosticCode = (typeof DIAGNOSTIC_CODES)[keyof typeof DIAGNOSTIC_CODES];

export interface Diagnostic {
  code: DiagnosticCode;
  message: string;
  context?: Record<string, string | number | boolean>;
}
